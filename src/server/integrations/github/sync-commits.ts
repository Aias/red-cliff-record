import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import {
	githubCommitChanges,
	githubCommits,
	githubRepositories,
	type GithubCommitChangeInsert,
	type GithubCommitInsert,
	type GithubRepositoryInsert,
} from '@/server/db/schema/github';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { syncGithubEmbeddings } from './embeddings';
import { syncCommitSummaries } from './summarize-all';
import { ensureGithubUserExists } from './sync-users';

type GithubRepository = Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

const MAX_PATCH_LENGTH = 2048;

async function getMostRecentCommitDate(): Promise<Date | null> {
	// Get latest commit based on committer date (reflects push/merge activity)
	const latestByCommitter = await db.query.githubCommits.findFirst({
		columns: { committedAt: true },
		orderBy: desc(githubCommits.committedAt),
	});

	// Get latest commit based on content created date (author date)
	const latestByAuthor = await db.query.githubCommits.findFirst({
		columns: { contentCreatedAt: true },
		orderBy: desc(githubCommits.contentCreatedAt),
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

async function ensureRepositoryExists(
	repoData: GithubRepository,
	integrationRunId: number
): Promise<number> {
	// First ensure the owner exists
	await ensureGithubUserExists(repoData.owner, integrationRunId);

	// Then insert repository if it doesn't exist
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
		where: eq(githubRepositories.id, repoData.id),
	});

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
		console.log(
			`Most recent commit activity in database: ${mostRecentCommitDate.toLocaleString()}`
		);
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

			// Use the committer-date qualifier so that any push/merge update (reflected by committer date)
			// after our mostRecentCommitDate will be included
			const queryStr = mostRecentCommitDate
				? `author:@me committer-date:>=${mostRecentCommitDate.toISOString().split('T')[0]}`
				: 'author:@me';

			const response = await octokit.rest.search.commits({
				q: queryStr,
				sort: 'committer-date',
				order: 'asc',
				per_page: PER_PAGE,
				page,
			});

			logRateLimitInfo(response);

			if (response.data.items.length === 0) {
				hasMore = false;
				break;
			}

			let processedAnyNewCommits = false;
			for (const item of response.data.items) {
				// First check if commit exists by SHA
				const existingCommit = await db.query.githubCommits.findFirst({
					columns: {
						id: true,
						sha: true,
					},
					where: eq(githubCommits.sha, item.sha),
				});

				if (existingCommit) {
					console.log(`Skipping existing commit ${item.sha}`);
					continue;
				}

				processedAnyNewCommits = true;
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

				console.log(`Inserted commit ${item.sha} for ${item.repository.full_name}`);

				totalCommits++;
			}

			// If we didn't process any new commits on this page, we can stop
			if (!processedAnyNewCommits) {
				console.log('No new commits found on this page, stopping pagination');
				hasMore = false;
				break;
			}

			console.log(`Processed new commits from page ${page}`);
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

	await syncCommitSummaries();
	await syncGithubEmbeddings();

	return totalCommits;
}

export { syncGitHubCommits };
