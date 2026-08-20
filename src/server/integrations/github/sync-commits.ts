import {
  githubCommitChanges,
  githubCommits,
  githubRepositories,
  type GithubCommitChangeInsert,
  type GithubCommitInsert,
  type GithubRepositoryInsert,
} from '@hozo';
import { RequestError } from '@octokit/request-error';
import type { Endpoints } from '@octokit/types';
import { db } from '@/server/db/connections/postgres';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { createGithubClient } from './octokit';
import { syncCommitSummaries } from './summarize-commits';
import { ensureGithubUserExists } from './sync-users';
import { toGithubId } from './types';

const logger = createIntegrationLogger('github', 'sync-commits');

/**
 * Type definitions
 */
type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];
type CommitSearchItem = Endpoints['GET /search/commits']['response']['data']['items'][number];

/**
 * Configuration constants
 */
const MAX_PATCH_LENGTH = 2048;
const PER_PAGE = 100;
const COMMIT_CONCURRENCY = 8;

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
 * Ensures a GitHub repository exists in the database
 *
 * This function creates or updates a repository record and ensures
 * the repository owner exists in the database.
 *
 * @param repoData - Repository data from GitHub API
 * @param integrationRunId - The ID of the current integration run
 * @returns The ID of the repository
 */
async function ensureRepositoryExists(
  repoData: GithubRepository,
  integrationRunId: number
): Promise<number> {
  // First ensure the owner exists
  await ensureGithubUserExists(repoData.owner, integrationRunId);

  // Prepare repository data for insertion
  const newRepo: GithubRepositoryInsert = {
    id: toGithubId(repoData.id),
    nodeId: repoData.node_id,
    name: repoData.name,
    fullName: repoData.full_name,
    ownerId: toGithubId(repoData.owner.id),
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
  };

  // starredAt is deliberately absent from the update set so a star date
  // written by the stars sync survives commit-driven upserts, including when
  // the two syncs run concurrently.
  await db
    .insert(githubRepositories)
    .values(newRepo)
    .onConflictDoUpdate({
      target: githubRepositories.id,
      set: {
        ...newRepo,
        recordUpdatedAt: new Date(),
      },
    });

  return toGithubId(repoData.id);
}

/**
 * Synchronizes GitHub commits with the database
 *
 * This function:
 * 1. Fetches commits from the GitHub API
 * 2. Determines which commits are new since the last sync
 * 3. Stores commit information and file changes in the database
 * 4. Triggers commit summary and embedding generation
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
  const octokit = createGithubClient();

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

  // Memoize per-run repository fetches and upserts: a push often lands many
  // commits in the same repository.
  const repositoryDataCache = new Map<string, Promise<GithubRepository>>();
  const getRepositoryData = (owner: string, repo: string): Promise<GithubRepository> => {
    const key = `${owner}/${repo}`;
    let cached = repositoryDataCache.get(key);
    if (!cached) {
      cached = octokit.rest.repos.get({ owner, repo }).then((response) => {
        logRateLimitInfo(response, logger);
        return response.data;
      });
      repositoryDataCache.set(key, cached);
    }
    return cached;
  };

  const ensuredRepositories = new Map<number, Promise<number>>();
  const ensureRepositoryOnce = (repoData: GithubRepository): Promise<number> => {
    const repositoryId = toGithubId(repoData.id);
    let ensured = ensuredRepositories.get(repositoryId);
    if (!ensured) {
      ensured = ensureRepositoryExists(repoData, integrationRunId);
      ensuredRepositories.set(repositoryId, ensured);
    }
    return ensured;
  };

  const processCommitItem = async (item: CommitSearchItem): Promise<'inserted' | 'skipped'> => {
    try {
      // Get the full repository data
      const repoData = await getRepositoryData(item.repository.owner.login, item.repository.name);

      // Skip if this is a fork and the commit is older than the fork date
      if (repoData.fork && new Date(item.commit.author.date) < new Date(repoData.created_at)) {
        logger.info(`Skipping commit ${item.sha} as it predates fork creation`);
        return 'skipped';
      }

      // Get detailed commit info including file changes
      const detailedCommit = await octokit.rest.repos.getCommit({
        owner: item.repository.owner.login,
        repo: item.repository.name,
        ref: item.sha,
      });
      logRateLimitInfo(detailedCommit, logger);

      // In debug mode, just count the commits without persisting
      if (skipPersist) {
        logger.info(`Would insert commit ${item.sha} for ${item.repository.full_name}`);
        return 'inserted';
      }

      // Ensure repository exists in database
      await ensureRepositoryOnce(repoData);

      // Insert new commit
      const newCommit: GithubCommitInsert = {
        id: item.node_id,
        sha: item.sha,
        message: item.commit.message,
        htmlUrl: item.html_url,
        repositoryId: toGithubId(item.repository.id),
        committedAt: item.commit.committer?.date ? new Date(item.commit.committer.date) : null,
        contentCreatedAt: new Date(item.commit.author.date),
        integrationRunId,
        changes: detailedCommit.data.stats?.total ?? null,
        additions: detailedCommit.data.stats?.additions ?? null,
        deletions: detailedCommit.data.stats?.deletions ?? null,
      };

      await db.insert(githubCommits).values(newCommit);

      // Insert commit changes
      const files = detailedCommit.data.files ?? [];
      if (files.length > 0) {
        const newChanges: GithubCommitChangeInsert[] = files.map((file) => ({
          filename: file.filename,
          status: file.status,
          patch: file.patch ? file.patch.slice(0, MAX_PATCH_LENGTH) : '',
          commitId: item.node_id,
          changes: file.changes,
          additions: file.additions,
          deletions: file.deletions,
        }));
        await db.insert(githubCommitChanges).values(newChanges);
      }

      logger.info(`Inserted commit ${item.sha} for ${item.repository.full_name}`);
      return 'inserted';
    } catch (error) {
      logger.error(`Error processing commit ${item.sha}`, {
        error: error instanceof Error ? error.message : String(error),
        repository: item.repository.full_name,
      });
      return 'skipped';
    }
  };

  let page = 1;
  let totalCommits = 0;

  while (true) {
    try {
      logger.info(`Fetching page ${page}...`);

      // Use the committer-date qualifier so that any push/merge update (reflected by committer date)
      // after our mostRecentCommitDate will be included
      const queryStr = mostRecentCommitDate
        ? `author:@me committer-date:>=${mostRecentCommitDate.toISOString().split('T')[0]}`
        : 'author:@me';

      // Search for commits authored by the authenticated user
      const response = await octokit.rest.search.commits({
        q: queryStr,
        sort: 'committer-date',
        order: 'asc',
        per_page: PER_PAGE,
        page,
      });

      // Log rate limit information for monitoring
      logRateLimitInfo(response, logger);

      // Collect debug data if requested
      if (collectDebugData) {
        collectDebugData.push(...response.data.items);
      }

      // Check if we've reached the end of the results
      if (response.data.items.length === 0) {
        break;
      }

      // One bulk existence check per page instead of one query per commit
      let newItems: CommitSearchItem[] = [...response.data.items];
      if (!skipPersist) {
        const existingCommits = await db.query.githubCommits.findMany({
          columns: { sha: true },
          where: { sha: { in: newItems.map((item) => item.sha) } },
        });
        const existingShas = new Set(existingCommits.map((commit) => commit.sha));
        if (existingShas.size > 0) {
          logger.info(`Skipping ${existingShas.size} existing commits on page ${page}`);
          newItems = newItems.filter((item) => !existingShas.has(item.sha));
        }
      }

      if (newItems.length === 0) {
        logger.info('No new commits found on this page, stopping pagination');
        break;
      }

      const results = await runConcurrentPool({
        items: newItems,
        concurrency: COMMIT_CONCURRENCY,
        worker: (item) => processCommitItem(item),
        onProgress: (completed, total) => {
          if (completed % 10 === 0 || completed === total) {
            logger.info(`Processing commits: ${completed}/${total}`);
          }
        },
      });
      totalCommits += results.filter((result) => result.ok && result.value === 'inserted').length;

      logger.info(`Processed new commits from page ${page}`);
      page++;
    } catch (error) {
      if (error instanceof RequestError) {
        logger.error('GitHub API Error', {
          status: error.status,
          message: error.message,
          headers: error.response?.headers,
        });
        if (error.response) {
          logRateLimitInfo(error.response, logger);
        }
        // If we hit rate limits, throw to stop the process
        if (error.status === 403 || error.status === 429) {
          throw new Error(`GitHub API rate limit exceeded: ${error.message}`);
        }
      }
      throw error;
    }
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
