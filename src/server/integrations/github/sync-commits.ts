import {
  githubCommitChanges,
  githubCommits,
  githubRepositories,
  type GithubCommitChangeInsert,
  type GithubCommitInsert,
  type GithubRepositoryInsert,
} from '@hozo';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { db } from '@/server/db/connections/postgres';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { syncCommitSummaries } from './summarize-commits';
import { ensureGithubUserExists } from './sync-users';

const logger = createIntegrationLogger('github', 'sync-commits');

/**
 * Type definitions
 */
type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];
type GithubCommitSearchItem = Endpoints['GET /search/commits']['response']['data']['items'][number];
type GithubCommitSearchRepository = GithubCommitSearchItem['repository'];

/**
 * Configuration constants
 */
const MAX_PATCH_LENGTH = 2048;
const PER_PAGE = 100;
const REQUEST_DELAY_MS = 1000;

function splitEnvList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Builds the GitHub commit-search queries that define which contributions to sync.
 *
 * `author:@me` matches commits linked to the authenticated account, but only in
 * public repos and the account's own private repos. Two env-driven extensions
 * widen this:
 * - GITHUB_COMMIT_SEARCH_ORGS scopes `author:@me` to a private org, surfacing
 *   contributions to repos the token can find via search but not read via REST.
 * - GITHUB_COMMIT_AUTHOR_EMAILS matches commits authored under an email that
 *   isn't linked to the authenticated account (e.g. a former work identity).
 */
export function getCommitSearchQueries(): string[] {
  const orgs = splitEnvList(process.env.GITHUB_COMMIT_SEARCH_ORGS);
  const emails = splitEnvList(process.env.GITHUB_COMMIT_AUTHOR_EMAILS);
  return [
    'author:@me',
    ...orgs.map((org) => `author:@me org:${org}`),
    ...emails.map((email) => `author-email:${email}`),
  ];
}

/**
 * A 403/404 from a repo or commit endpoint means the token can't read the repo
 * (typically a private org repo found via search but not granted via REST).
 * These are recoverable: the commit is still recorded from its search metadata.
 */
function isRepoAccessError(error: unknown): boolean {
  return error instanceof RequestError && (error.status === 403 || error.status === 404);
}

/**
 * Retrieves the most recent commit date from the database
 *
 * This function checks both author date and committer date to find
 * the most recent activity, which is used as a cutoff for fetching new commits.
 *
 * @returns The date of the most recent commit activity, or null if none exists
 */
async function getMostRecentCommitDate(): Promise<Date | null> {
  // Get latest commit based on committer date (reflects push/merge activity)
  const latestByCommitter = await db.query.githubCommits.findFirst({
    columns: { committedAt: true },
    orderBy: {
      committedAt: 'desc',
    },
  });

  // Get latest commit based on content created date (author date)
  const latestByAuthor = await db.query.githubCommits.findFirst({
    columns: { contentCreatedAt: true },
    orderBy: {
      contentCreatedAt: 'desc',
    },
  });

  const latestCommitterTime = latestByCommitter?.committedAt
    ? latestByCommitter.committedAt.getTime()
    : 0;
  const latestAuthorTime = latestByAuthor?.contentCreatedAt
    ? latestByAuthor.contentCreatedAt.getTime()
    : 0;
  const lastActivityTime = Math.max(latestCommitterTime, latestAuthorTime);
  return lastActivityTime ? new Date(lastActivityTime) : null;
}

/**
 * Upserts a repository row, preserving an existing starredAt timestamp.
 */
async function upsertRepository(newRepo: GithubRepositoryInsert): Promise<void> {
  const existingRepo = await db.query.githubRepositories.findFirst({
    columns: { starredAt: true },
    where: { id: newRepo.id },
  });

  await db
    .insert(githubRepositories)
    .values(newRepo)
    .onConflictDoUpdate({
      target: githubRepositories.id,
      set: {
        ...newRepo,
        recordUpdatedAt: new Date(),
        // Only include starredAt if it exists in the database
        ...(existingRepo?.starredAt && { starredAt: existingRepo.starredAt }),
      },
    });
}

/**
 * Ensures a GitHub repository exists in the database from full REST repo data,
 * along with its owner.
 *
 * @returns The ID of the repository
 */
async function ensureRepositoryExists(
  repoData: GithubRepository,
  integrationRunId: number
): Promise<number> {
  await ensureGithubUserExists(repoData.owner, integrationRunId);

  await upsertRepository({
    id: repoData.id,
    nodeId: repoData.node_id,
    name: repoData.name,
    fullName: repoData.full_name,
    ownerId: repoData.owner.id,
    private: repoData.private,
    htmlUrl: repoData.html_url,
    homepageUrl: repoData.homepage,
    licenseName: repoData.license?.name,
    description: repoData.description,
    language: repoData.language,
    topics: repoData.topics,
    integrationRunId,
    contentCreatedAt: new Date(repoData.created_at),
    contentUpdatedAt: new Date(repoData.updated_at),
  });

  return repoData.id;
}

/**
 * Ensures a repository exists from the partial metadata carried by a commit
 * search result, for repos the token can find via search but not read via REST.
 * Fields only available from the full REST response (timestamps, license,
 * homepage) are left null.
 *
 * @returns The ID of the repository
 */
async function ensureRepositoryFromSearch(
  repo: GithubCommitSearchRepository,
  integrationRunId: number
): Promise<number> {
  await ensureGithubUserExists(repo.owner, integrationRunId);

  await upsertRepository({
    id: repo.id,
    nodeId: repo.node_id,
    name: repo.name,
    fullName: repo.full_name,
    ownerId: repo.owner.id,
    private: repo.private,
    htmlUrl: repo.html_url,
    description: repo.description,
    language: repo.language ?? null,
    topics: repo.topics && repo.topics.length > 0 ? repo.topics : null,
    integrationRunId,
  });

  return repo.id;
}

/**
 * Fetches full detail for a searched commit and upserts it with its file changes.
 *
 * When the repository can't be read via REST (a private org repo surfaced by
 * search but not granted to the token), the commit is recorded from its search
 * metadata alone — without per-file changes or line stats.
 *
 * @returns 'inserted' when a new commit is written (or would be, in debug mode),
 *   'skipped' when it already exists or predates a fork's creation
 */
export async function upsertCommitFromSearchItem(
  octokit: Octokit,
  item: GithubCommitSearchItem,
  integrationRunId: number,
  skipPersist: boolean
): Promise<'inserted' | 'skipped'> {
  if (!skipPersist) {
    const existingCommit = await db.query.githubCommits.findFirst({
      columns: { id: true },
      where: { sha: item.sha },
    });
    if (existingCommit) {
      logger.info(`Skipping existing commit ${item.sha}`);
      return 'skipped';
    }
  }

  let repoData: GithubRepository | null = null;
  let detail: Endpoints['GET /repos/{owner}/{repo}/commits/{ref}']['response']['data'] | null =
    null;

  try {
    const repoResponse = await octokit.rest.repos.get({
      owner: item.repository.owner.login,
      repo: item.repository.name,
    });
    logRateLimitInfo(repoResponse, logger);
    repoData = repoResponse.data;

    // Skip commits that predate a fork's creation — they belong to the upstream repo.
    if (repoData.fork) {
      const commitDate = new Date(item.commit.author.date);
      const forkDate = new Date(repoData.created_at);
      if (commitDate < forkDate) {
        logger.info(`Skipping commit ${item.sha} as it predates fork creation`);
        return 'skipped';
      }
    }

    const detailResponse = await octokit.rest.repos.getCommit({
      owner: item.repository.owner.login,
      repo: item.repository.name,
      ref: item.sha,
    });
    logRateLimitInfo(detailResponse, logger);
    detail = detailResponse.data;
  } catch (error) {
    if (!isRepoAccessError(error)) {
      throw error;
    }
    logger.info(
      `No REST access to ${item.repository.full_name}; recording ${item.sha} from search metadata`
    );
  }

  if (skipPersist) {
    logger.info(`Would insert commit ${item.sha} for ${item.repository.full_name}`);
    return 'inserted';
  }

  if (repoData) {
    await ensureRepositoryExists(repoData, integrationRunId);
  } else {
    await ensureRepositoryFromSearch(item.repository, integrationRunId);
  }

  const newCommit: GithubCommitInsert = {
    id: item.node_id,
    sha: item.sha,
    message: item.commit.message,
    htmlUrl: item.html_url,
    repositoryId: item.repository.id,
    committedAt: item.commit.committer?.date ? new Date(item.commit.committer.date) : null,
    contentCreatedAt: new Date(item.commit.author.date),
    integrationRunId,
    changes: detail?.stats?.total ?? null,
    additions: detail?.stats?.additions ?? null,
    deletions: detail?.stats?.deletions ?? null,
  };
  await db.insert(githubCommits).values(newCommit);

  for (const file of detail?.files ?? []) {
    const newChange: GithubCommitChangeInsert = {
      filename: file.filename,
      status: file.status,
      patch: file.patch ? file.patch.slice(0, MAX_PATCH_LENGTH) : '',
      commitId: item.node_id,
      changes: file.changes,
      additions: file.additions,
      deletions: file.deletions,
    };
    await db.insert(githubCommitChanges).values(newChange);
  }

  logger.info(`Inserted commit ${item.sha} for ${item.repository.full_name}`);
  return 'inserted';
}

/**
 * Paginates one commit-search query, upserting each new commit.
 *
 * Stops when results are exhausted or a page yields no new commits (the search
 * is sorted by committer date ascending, so an all-existing page means we've
 * caught up to previously synced history).
 *
 * @returns The number of new commits inserted for this query
 */
async function syncCommitsForQuery(
  octokit: Octokit,
  searchQuery: string,
  mostRecentCommitDate: Date | null,
  integrationRunId: number,
  collectDebugData: unknown[] | undefined,
  skipPersist: boolean
): Promise<number> {
  let page = 1;
  let insertedCount = 0;

  while (true) {
    logger.info(`[${searchQuery}] Fetching page ${page}...`);

    // The committer-date qualifier limits to push/merge activity newer than the
    // most recent commit already synced.
    const queryStr = mostRecentCommitDate
      ? `${searchQuery} committer-date:>=${mostRecentCommitDate.toISOString().split('T')[0]}`
      : searchQuery;

    let items: GithubCommitSearchItem[];
    try {
      const response = await octokit.rest.search.commits({
        q: queryStr,
        sort: 'committer-date',
        order: 'asc',
        per_page: PER_PAGE,
        page,
      });
      logRateLimitInfo(response, logger);
      items = response.data.items;
    } catch (error) {
      if (error instanceof RequestError) {
        logger.error('GitHub search error', { status: error.status, message: error.message });
        if (error.response) {
          logRateLimitInfo(error.response, logger);
        }
        if (error.status === 403 || error.status === 429) {
          throw new Error(`GitHub API rate limit exceeded: ${error.message}`);
        }
      }
      throw error;
    }

    if (collectDebugData) {
      collectDebugData.push(...items);
    }
    if (items.length === 0) {
      break;
    }

    let processedAnyNew = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) {
        logger.warn(`Missing commit item at index ${i} on page ${page}`);
        continue;
      }
      try {
        const result = await upsertCommitFromSearchItem(
          octokit,
          item,
          integrationRunId,
          skipPersist
        );
        if (result === 'inserted') {
          insertedCount++;
          processedAnyNew = true;
        }
      } catch (error) {
        logger.error(`Error processing commit ${item.sha}`, {
          error: error instanceof Error ? error.message : String(error),
          repository: item.repository?.full_name,
        });
      }
      await Bun.sleep(REQUEST_DELAY_MS);
      logger.info(`[${searchQuery}] Processed ${i + 1}/${items.length}`);
    }

    if (!processedAnyNew) {
      logger.info(`[${searchQuery}] No new commits on page ${page}, stopping pagination`);
      break;
    }
    page++;
  }

  return insertedCount;
}

/**
 * Synchronizes GitHub commits with the database
 *
 * Runs each configured commit-search query (the authenticated user plus any
 * extra org scopes and author emails), records new commits and their file
 * changes, and triggers summary/embedding generation.
 *
 * @param integrationRunId - The ID of the current integration run
 * @param collectDebugData - Optional array to collect raw API data for debugging
 * @param skipPersist - If true, only fetches data without writing to database (debug mode)
 * @returns The number of new commits processed
 * @throws Error if the GitHub API request fails
 */
async function syncGitHubCommits(
  integrationRunId: number,
  collectDebugData?: unknown[],
  skipPersist = false
): Promise<number> {
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  logger.start('Fetching GitHub commits');

  // Get the most recent commit date to use as a cutoff (skip DB query in debug mode)
  const mostRecentCommitDate = skipPersist ? null : await getMostRecentCommitDate();
  if (mostRecentCommitDate) {
    logger.info(
      `Most recent commit activity in database: ${mostRecentCommitDate.toLocaleString()}`
    );
  } else if (!skipPersist) {
    logger.info('No existing commits in database');
  }

  const searchQueries = getCommitSearchQueries();
  logger.info(`Searching commits across ${searchQueries.length} queries`);

  let totalCommits = 0;
  for (const searchQuery of searchQueries) {
    totalCommits += await syncCommitsForQuery(
      octokit,
      searchQuery,
      mostRecentCommitDate,
      integrationRunId,
      collectDebugData,
      skipPersist
    );
  }

  logger.complete('Synced commits', totalCommits);

  // Generate summaries and embeddings for the new commits (skip in debug mode)
  if (totalCommits > 0 && !skipPersist) {
    logger.info('Generating commit summaries...');
    await syncCommitSummaries();
  }

  return totalCommits;
}

export { syncGitHubCommits };
