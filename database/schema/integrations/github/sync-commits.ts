import { Octokit } from '@octokit/rest';
import { loadEnv } from '@rcr/lib/env';
import { RequestError } from '@octokit/request-error';
import { createPgConnection } from '../../connections';
import {
	githubRepositories,
	githubCommits,
	githubCommitChanges,
	type NewGithubRepository,
	type NewGithubCommit,
	type NewGithubCommitChange,
} from './schema';
import { eq, desc } from 'drizzle-orm';
import { logRateLimitInfo } from './helpers';
import type { Endpoints } from '@octokit/types';
import { ensureGithubUserExists } from './sync-users';
type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

loadEnv();

const db = createPgConnection();
const MAX_PATCH_LENGTH = 2048;

async function getMostRecentCommitDate(): Promise<Date | null> {
	const [result] = await db
		.select({ contentCreatedAt: githubCommits.contentCreatedAt })
		.from(githubCommits)
		.orderBy(desc(githubCommits.contentCreatedAt))
		.limit(1);

	return result?.contentCreatedAt ?? null;
}

async function ensureRepositoryExists(
	repoData: GithubRepository,
	integrationRunId: number
): Promise<number> {
	// First ensure the owner exists
	await ensureGithubUserExists(db, repoData.owner, integrationRunId);

	// Then insert repository if it doesn't exist
	const newRepo: NewGithubRepository = {
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
	const [existingRepo] = await db
		.select({ starredAt: githubRepositories.starredAt })
		.from(githubRepositories)
		.where(eq(githubRepositories.id, repoData.id))
		.limit(1);

	await db
		.insert(githubRepositories)
		.values(newRepo)
		.onConflictDoUpdate({
			target: githubRepositories.id,
			set: {
				...newRepo,
				// Only include starredAt if it exists in the database
				...(existingRepo?.starredAt && { starredAt: existingRepo.starredAt }),
			},
		});

	return repoData.id;
}

async function syncGitHubCommits(integrationRunId: number): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	console.log('Fetching GitHub commits...');

	const mostRecentCommitDate = await getMostRecentCommitDate();
	if (mostRecentCommitDate) {
		console.log(`Most recent commit in database: ${mostRecentCommitDate.toISOString()}`);
	} else {
		console.log('No existing commits in database');
	}

	let page = 1;
	let hasMore = true;
	let totalCommits = 0;
	const PER_PAGE = 100;

	while (hasMore) {
		try {
			console.log(`Fetching page ${page}...`);
			const response = await octokit.rest.search.commits({
				q: mostRecentCommitDate
					? `author:@me author-date:>=${mostRecentCommitDate.toISOString().split('T')[0]}`
					: 'author:@me',
				sort: 'author-date',
				order: 'asc',
				per_page: PER_PAGE,
				page,
			});

			logRateLimitInfo(response);

			if (response.data.items.length === 0) {
				hasMore = false;
				break;
			}

			for (const item of response.data.items) {
				// First get the full repository data
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
						console.log(`Skipping commit ${item.sha} as it predates fork creation`);
						continue;
					}
				}

				// First check if commit exists by SHA
				const [existingCommit] = await db
					.select({
						nodeId: githubCommits.nodeId,
						sha: githubCommits.sha,
					})
					.from(githubCommits)
					.where(eq(githubCommits.sha, item.sha))
					.limit(1);

				if (existingCommit) {
					console.log(`Skipping existing commit ${item.sha}`);
					continue; // Skip both commit and changes insertion
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
				const newCommit: NewGithubCommit = {
					nodeId: item.node_id,
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
					const newChange: NewGithubCommitChange = {
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

				console.log(`Inserted commit ${item.sha} for ${item.repository.full_name}`);

				totalCommits++;
			}

			console.log(`Processed new commits from page ${page}`);

			// Add a small delay between requests
			await new Promise((resolve) => setTimeout(resolve, 1000));
			page++;
		} catch (error) {
			if (error instanceof RequestError) {
				console.error('GitHub API Error:', {
					status: error.status,
					message: error.message,
					headers: error.response?.headers,
				});
				if (error.response) {
					logRateLimitInfo(error.response);
				}
				// If we hit rate limits, throw to stop the process
				if (error.status === 403 || error.status === 429) {
					throw error;
				}
			}
			throw error;
		}
	}

	console.log(`Successfully synced ${totalCommits} new commits`);
	return totalCommits;
}

export { syncGitHubCommits };
