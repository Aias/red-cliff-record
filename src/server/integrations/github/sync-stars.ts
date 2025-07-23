import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { db } from '@/server/db/connections';
import { githubRepositories, type GithubRepositoryInsert } from '@/server/db/schema/github';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { ensureGithubUserExists } from './sync-users';
import { GithubStarredReposResponseSchema } from './types';

const logger = createIntegrationLogger('github', 'sync-stars');

/**
 * Configuration constants
 */
const PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 1000;

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
 * Synchronizes GitHub starred repositories with the database
 *
 * This function:
 * 1. Fetches starred repositories from the GitHub API
 * 2. Determines which stars are new since the last sync
 * 3. Stores repository information in the database
 * 4. Ensures repository owners exist in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of new starred repositories processed
 * @throws Error if the GitHub API request fails
 */
export async function syncGitHubStars(integrationRunId: number): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	logger.start('Fetching GitHub starred repos');

	// Get the most recent star date to use as a cutoff
	const mostRecentStarredAt = await getMostRecentStarredAt();
	if (mostRecentStarredAt) {
		logger.info(`Most recent star in database: ${mostRecentStarredAt.toLocaleString()}`);
	} else {
		logger.info('No existing stars in database');
	}

	let page = 1;
	let hasMore = true;
	let totalStars = 0;

	while (hasMore) {
		try {
			logger.info(`Fetching page ${page}...`);
			const response = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
				mediaType: {
					format: 'vnd.github.star+json',
				},
				per_page: PAGE_SIZE,
				page,
			});

			// Log rate limit information for monitoring
			logRateLimitInfo(response);

			// Parse and validate the response
			const parsedResponse = GithubStarredReposResponseSchema.parse(response);

			// Check if we've reached the end of the results
			if (parsedResponse.data.length === 0) {
				hasMore = false;
				break;
			}

			// Check if we've hit stars older than our most recent
			if (mostRecentStarredAt) {
				const oldestStarOnPage = parsedResponse.data.reduce(
					(oldest, star) => (star.starred_at < oldest ? star.starred_at : oldest),
					parsedResponse.data[0]!.starred_at
				);
				if (oldestStarOnPage <= mostRecentStarredAt) {
					logger.info(
						`Reached stars older than ${mostRecentStarredAt.toLocaleString()}, stopping pagination`
					);
					hasMore = false;
				}
			}

			// Process each starred repo
			for (const { repo, starred_at } of parsedResponse.data) {
				// Skip if this star is older than our most recent
				if (mostRecentStarredAt && new Date(starred_at) <= mostRecentStarredAt) {
					continue;
				}

				try {
					// First ensure the owner exists using shared helper
					await ensureGithubUserExists(repo.owner, integrationRunId);

					// Then insert the repository
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

					totalStars++;
				} catch (error) {
					logger.error(`Error processing starred repo ${repo.full_name}`, {
						error: error instanceof Error ? error.message : String(error),
						repoId: repo.id,
					});
					// Continue with next repo rather than failing the entire sync
				}
			}

			logger.info(`Processed new stars from page ${page}`);

			// Add a small delay between requests to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
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

	logger.complete('Synced starred repositories', totalStars);
	return totalStars;
}
