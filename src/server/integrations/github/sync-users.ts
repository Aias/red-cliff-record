import { githubUsers, type GithubUserInsert } from '@hozo';
import { RequestError } from '@octokit/request-error';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { createGithubClient } from './octokit';
import { toGithubId } from './types';

const logger = createIntegrationLogger('github', 'sync-users');

/**
 * Configuration constants
 */
const USER_CONCURRENCY = 10;

/**
 * Ensures a GitHub user exists in the database
 *
 * This function creates or updates a user record with basic information.
 * The user is marked as "partial" until full information is fetched.
 *
 * @param userData - Basic user data from GitHub API
 * @param integrationRunId - The ID of the current integration run
 * @returns The ID of the user
 */
export async function ensureGithubUserExists(
  userData: {
    id: number | bigint;
    login: string;
    node_id: string;
    html_url: string;
    avatar_url: string;
    type: string;
  },
  integrationRunId: number
): Promise<number> {
  // Prepare user data for insertion
  const user: GithubUserInsert = {
    id: toGithubId(userData.id),
    login: userData.login,
    nodeId: userData.node_id,
    htmlUrl: userData.html_url,
    avatarUrl: userData.avatar_url,
    type: userData.type,
    partial: true, // Mark as partial until full information is fetched
    integrationRunId,
  };

  // Insert or update the user record
  await db
    .insert(githubUsers)
    .values(user)
    .onConflictDoUpdate({
      target: githubUsers.id,
      set: {
        ...user,
        recordUpdatedAt: new Date(),
      },
    });

  return toGithubId(userData.id);
}

/**
 * Updates GitHub users with partial information
 *
 * This function:
 * 1. Finds all users marked as "partial" in the database
 * 2. Fetches complete user information from the GitHub API
 * 3. Updates the user records with the full information
 *
 * @returns The number of users successfully updated
 * @throws Error if a non-API failure (e.g. database error) occurs
 */
export async function updatePartialUsers(): Promise<number> {
  const octokit = createGithubClient();

  logger.start('Fetching full user information for partial users');

  // Find all users marked as partial
  const partialUsers = await db.query.githubUsers.findMany({
    where: {
      partial: true,
      deletedAt: {
        isNull: true,
      },
    },
  });

  logger.info(`Found ${partialUsers.length} partial users to update`);

  if (partialUsers.length === 0) {
    logger.complete('No partial users to update', 0);
    return 0;
  }

  const results = await runConcurrentPool({
    items: partialUsers,
    concurrency: USER_CONCURRENCY,
    worker: async (user) => {
      try {
        const response = await octokit.rest.users.getByUsername({
          username: user.login,
          headers: {
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        logRateLimitInfo(response, logger);

        const userData = response.data;

        await db
          .update(githubUsers)
          .set({
            name: userData.name,
            company: userData.company,
            blog: userData.blog,
            location: userData.location,
            email: userData.email,
            bio: userData.bio,
            twitterUsername: userData.twitter_username,
            followers: userData.followers,
            following: userData.following,
            contentCreatedAt: new Date(userData.created_at),
            contentUpdatedAt: new Date(userData.updated_at),
            partial: false,
            recordUpdatedAt: new Date(),
          })
          .where(eq(githubUsers.id, user.id));

        logger.info(`Updated user ${user.login}`);
        return true;
      } catch (error) {
        if (error instanceof RequestError) {
          logger.error(`Error fetching user ${user.login}`, {
            status: error.status,
            message: error.message,
            headers: error.response?.headers,
          });

          if (error.response) {
            logRateLimitInfo(error.response, logger);
          }

          logger.warn(`Skipping user ${user.login} due to error`);
          return false;
        }
        throw error;
      }
    },
    onProgress: (completed, total) => {
      if (completed % 10 === 0 || completed === total) {
        logger.info(`Progress: ${completed}/${total} users`);
      }
    },
  });

  // API errors skip the individual user; anything else (e.g. a database
  // failure) is systemic and should abort the run
  const firstFailure = results.find((result) => !result.ok);
  if (firstFailure && !firstFailure.ok) {
    throw firstFailure.error;
  }

  const updatedCount = results.filter((result) => result.ok && result.value).length;
  logger.complete('Updated users with full information', updatedCount);
  return updatedCount;
}
