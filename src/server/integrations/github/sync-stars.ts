import { githubRepositories, type GithubRepositoryInsert } from '@hozo';
import { RequestError } from '@octokit/request-error';
import type { Octokit } from '@octokit/rest';
import { db } from '@/server/db/connections/postgres';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { createGithubClient } from './octokit';
import { ensureGithubUserExists } from './sync-users';
import { GithubStarredReposResponseSchema, type StarredRepo } from './types';

const logger = createIntegrationLogger('github', 'sync-stars');

/**
 * Configuration constants
 */
const PAGE_SIZE = 100;
const DB_CONCURRENCY = 10;

/**
 * Retrieves the most recent starred date from the database
 *
 * This is used to determine the cutoff point for fetching new stars
 *
 * @returns The date of the most recently starred repository, or null if none exists
 */
async function getMostRecentStarredAt(): Promise<Date | null> {
  const result = await db.query.githubRepositories.findFirst({
    columns: {
      starredAt: true,
    },
    where: {
      starredAt: {
        isNotNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
    orderBy: {
      starredAt: 'desc',
    },
  });

  return result?.starredAt ?? null;
}

/**
 * Upserts a single starred repository; its owner must already exist
 *
 * @param star - The starred repo data from the API
 * @param integrationRunId - The ID of the current integration run
 * @returns True if the repo was processed successfully
 */
async function processStarredRepo(star: StarredRepo, integrationRunId: number): Promise<boolean> {
  const { repo, starred_at } = star;

  try {
    const newRepo: GithubRepositoryInsert = {
      id: repo.id,
      nodeId: repo.node_id,
      name: repo.name,
      fullName: repo.full_name,
      ownerId: repo.owner.id,
      private: repo.private,
      htmlUrl: repo.html_url,
      homepageUrl: repo.homepage,
      licenseName: repo.license?.name,
      description: repo.description,
      language: repo.language,
      topics: repo.topics.length > 0 ? repo.topics : null,
      starredAt: starred_at,
      contentCreatedAt: repo.created_at,
      contentUpdatedAt: repo.updated_at,
      integrationRunId,
    };

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

    return true;
  } catch (error) {
    logger.error(`Error processing starred repo ${repo.full_name}`, {
      error: error instanceof Error ? error.message : String(error),
      repoId: repo.id,
    });
    // Return false to indicate failure but allow processing to continue
    return false;
  }
}

/**
 * Fetches a single page of starred repos from the GitHub API
 *
 * @param octokit - The authenticated Octokit instance
 * @param page - The page number to fetch
 * @returns Parsed starred repos data and rate limit info
 */
async function fetchStarredReposPage(octokit: Octokit, page: number) {
  const response = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
    mediaType: {
      format: 'vnd.github.star+json',
    },
    per_page: PAGE_SIZE,
    page,
  });

  logRateLimitInfo(response, logger);

  return GithubStarredReposResponseSchema.parse(response);
}

/**
 * Synchronizes GitHub starred repositories with the database
 *
 * This function:
 * 1. Fetches starred repositories from the GitHub API
 * 2. Determines which stars are new since the last sync
 * 3. Stores repository information in the database
 * 4. Ensures repository owners exist in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @param collectDebugData - Optional array to collect raw API data for debugging
 * @param skipPersist - If true, only fetches data without writing to database (debug mode)
 * @returns The number of new starred repositories processed
 * @throws Error if the GitHub API request fails
 */
export async function syncGitHubStars(
  integrationRunId: number,
  collectDebugData?: unknown[],
  skipPersist = false
): Promise<number> {
  const octokit = createGithubClient();

  logger.start('Fetching GitHub starred repos');

  // Get the most recent star date to use as a cutoff (skip DB query in debug mode)
  const mostRecentStarredAt = skipPersist ? null : await getMostRecentStarredAt();
  if (mostRecentStarredAt) {
    logger.info(`Most recent star in database: ${mostRecentStarredAt.toLocaleString()}`);
  } else if (!skipPersist) {
    logger.info('No existing stars in database');
  }

  // Collect all new starred repos first
  const allNewStars: StarredRepo[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      logger.info(`Fetching page ${page}...`);
      const parsedResponse = await fetchStarredReposPage(octokit, page);

      // Collect debug data if requested
      if (collectDebugData) {
        collectDebugData.push(...parsedResponse.data);
      }

      // Check if we've reached the end of the results
      if (parsedResponse.data.length === 0) {
        hasMore = false;
        break;
      }

      // Check if we've hit stars older than our most recent
      if (mostRecentStarredAt) {
        const firstStar = parsedResponse.data[0];
        if (!firstStar) {
          hasMore = false;
          break;
        }
        const oldestStarOnPage = parsedResponse.data.reduce(
          (oldest, star) => (star.starred_at < oldest ? star.starred_at : oldest),
          firstStar.starred_at
        );
        if (oldestStarOnPage <= mostRecentStarredAt) {
          logger.info(
            `Reached stars older than ${mostRecentStarredAt.toLocaleString()}, stopping pagination`
          );
          hasMore = false;
        }
      }

      // Filter to only new stars
      const newStarsOnPage = parsedResponse.data.filter(
        (star) => !mostRecentStarredAt || star.starred_at > mostRecentStarredAt
      );
      allNewStars.push(...newStarsOnPage);

      logger.info(`Found ${newStarsOnPage.length} new stars on page ${page}`);
      page++;
    } catch (error) {
      if (error instanceof RequestError) {
        logger.error('GitHub API Error', {
          status: error.status,
          message: error.message,
          headers: error.response?.headers,
        });
        if (error.response) {
          logRateLimitInfo(error.response);
        }

        // If we hit rate limits, throw to stop the process
        if (error.status === 403 || error.status === 429) {
          throw new Error(`GitHub API rate limit exceeded: ${error.message}`);
        }
      }
      throw error;
    }
  }

  // In debug mode, just return the count
  if (skipPersist) {
    logger.complete('Found starred repositories (debug mode)', allNewStars.length);
    return allNewStars.length;
  }

  // Upsert each unique owner once, then the repositories concurrently
  const ownersById = new Map<number, StarredRepo['repo']['owner']>();
  for (const star of allNewStars) {
    ownersById.set(star.repo.owner.id, star.repo.owner);
  }
  await runConcurrentPool({
    items: [...ownersById.values()],
    concurrency: DB_CONCURRENCY,
    worker: (owner) => ensureGithubUserExists(owner, integrationRunId),
  });

  const results = await runConcurrentPool({
    items: allNewStars,
    concurrency: DB_CONCURRENCY,
    worker: (star) => processStarredRepo(star, integrationRunId),
    onProgress: (completed, total) => {
      if (completed % 25 === 0 || completed === total) {
        logger.info(`Processed ${completed}/${total} starred repos`);
      }
    },
  });
  const successCount = results.filter((result) => result.ok && result.value).length;

  logger.complete('Synced starred repositories', successCount);
  return successCount;
}
