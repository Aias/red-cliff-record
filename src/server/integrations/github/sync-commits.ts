import {
	githubCommitChanges,
	githubCommits,
	githubRepositories,
	type GithubCommitChangeInsert,
	type GithubCommitInsert,
	type GithubRepositoryInsert,
} from '@aias/hozo';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { db } from '@/server/db/connections';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { createIntegrationLogger } from '../common/logging';
import { syncCommitSummaries } from './summarize-commits';
import { ensureGithubUserExists } from './sync-users';

const logger = createIntegrationLogger('github', 'sync-commits');

/**
 * Type definitions
 */
type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

/**
 * Configuration constants
 */
const MAX_PATCH_LENGTH = 2048;
const PER_PAGE = 100;
const REQUEST_DELAY_MS = 1000;

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
	};

	// First try to get existing repository to preserve starredAt
	const existingRepo = await db.query.githubRepositories.findFirst({
		columns: {
			starredAt: true,
		},
		where: {
			id: repoData.id,
		},
	});

	// Insert or update the repository
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

	return repoData.id;
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
 * @returns The number of new commits processed
 * @throws Error if the GitHub API request fails
 */
async function syncGitHubCommits(
	integrationRunId: number,
	collectDebugData?: unknown[]
): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	logger.start('Fetching GitHub commits');

	// Get the most recent commit date to use as a cutoff
	const mostRecentCommitDate = await getMostRecentCommitDate();
	if (mostRecentCommitDate) {
		logger.info(
			`Most recent commit activity in database: ${mostRecentCommitDate.toLocaleString()}`
		);
	} else {
		logger.info('No existing commits in database');
	}

	let page = 1;
	let hasMore = true;
	let totalCommits = 0;

	while (hasMore) {
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
			logRateLimitInfo(response);

			// Collect debug data if requested
			if (collectDebugData) {
				collectDebugData.push(...response.data.items);
			}

			// Check if we've reached the end of the results
			if (response.data.items.length === 0) {
				hasMore = false;
				break;
			}

			let processedAnyNewCommits = false;
			for (const item of response.data.items) {
				try {
					// First check if commit exists by SHA
					const existingCommit = await db.query.githubCommits.findFirst({
						columns: {
							id: true,
							sha: true,
						},
						where: {
							sha: item.sha,
						},
					});

					if (existingCommit) {
						logger.info(`Skipping existing commit ${item.sha}`);
						continue;
					}

					processedAnyNewCommits = true;

					// Get the full repository data
					const repoResponse = await octokit.rest.repos.get({
						owner: item.repository.owner.login,
						repo: item.repository.name,
					});

					logRateLimitInfo(repoResponse);

					// Skip if this is a fork and the commit is older than the fork date
					if (repoResponse.data.fork) {
						const commitDate = new Date(item.commit.author.date);
						const forkDate = new Date(repoResponse.data.created_at);

						if (commitDate < forkDate) {
							logger.info(`Skipping commit ${item.sha} as it predates fork creation`);
							continue;
						}
					}

					// Get detailed commit info including file changes
					const detailedCommit = await octokit.rest.repos.getCommit({
						owner: item.repository.owner.login,
						repo: item.repository.name,
						ref: item.sha,
					});

					logRateLimitInfo(detailedCommit);

					// Ensure repository exists in database
					await ensureRepositoryExists(repoResponse.data, integrationRunId);

					// Insert new commit
					const newCommit: GithubCommitInsert = {
						id: item.node_id,
						sha: item.sha,
						message: item.commit.message,
						htmlUrl: item.html_url,
						repositoryId: item.repository.id,
						committedAt: item.commit.committer?.date ? new Date(item.commit.committer.date) : null,
						contentCreatedAt: new Date(item.commit.author.date),
						integrationRunId,
						changes: detailedCommit.data.stats?.total ?? null,
						additions: detailedCommit.data.stats?.additions ?? null,
						deletions: detailedCommit.data.stats?.deletions ?? null,
					};

					await db.insert(githubCommits).values(newCommit);

					// Insert commit changes only for new commits
					for (const file of detailedCommit.data.files || []) {
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
					totalCommits++;

					// Add a small delay between requests to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
				} catch (error) {
					logger.error(`Error processing commit ${item.sha}`, {
						error: error instanceof Error ? error.message : String(error),
						repository: item.repository?.full_name,
					});
					// Continue with next commit rather than failing the entire sync
				}
			}

			// If we didn't process any new commits on this page, we can stop
			if (!processedAnyNewCommits) {
				logger.info('No new commits found on this page, stopping pagination');
				hasMore = false;
				break;
			}

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

	logger.complete('Synced commits', totalCommits);

	// Generate summaries and embeddings for the new commits
	if (totalCommits > 0) {
		logger.info('Generating commit summaries...');
		await syncCommitSummaries();
	}

	return totalCommits;
}

export { syncGitHubCommits };
