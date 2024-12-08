import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { loadEnv } from '@rcr/lib/env';
import { eq, desc } from 'drizzle-orm';
import { createPgConnection } from 'schema/connections';
import {
	githubUsers,
	githubRepositories,
	type NewGithubUser,
	type NewGithubRepository,
} from './schema';
import { GithubStarredReposResponseSchema } from './types';
import { logRateLimitInfo } from './helpers';

loadEnv();
const db = createPgConnection();

const PAGE_SIZE = 50;

async function updatePartialUsers(octokit: Octokit): Promise<number> {
	console.log('Fetching full user information for partial users...');

	// Get all partial users
	const partialUsers = await db.select().from(githubUsers).where(eq(githubUsers.partial, true));

	console.log(`Found ${partialUsers.length} partial users to update`);
	let updatedCount = 0;

	for (const user of partialUsers) {
		try {
			console.log(`Fetching full information for user ${user.login}...`);
			const response = await octokit.rest.users.getByUsername({
				username: user.login,
				headers: {
					'X-GitHub-Api-Version': '2022-11-28',
				},
			});

			logRateLimitInfo(response);

			const userData = response.data;

			// Update user with full information
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
				})
				.where(eq(githubUsers.id, user.id));

			updatedCount++;
			console.log(`Updated user ${user.login}`);

			// Add delay between requests
			// await new Promise((resolve) => setTimeout(resolve, 1000));
		} catch (error) {
			if (error instanceof RequestError) {
				console.error(`Error fetching user ${user.login}:`, {
					status: error.status,
					message: error.message,
				});
				if (error.response) {
					logRateLimitInfo(error.response);
				}
				// If we hit rate limits, throw to stop the process
				if (error.status === 403 || error.status === 429) {
					throw error;
				}
				// For other errors, continue with next user
				console.log(`Skipping user ${user.login} due to error`);
				continue;
			}
			throw error;
		}
	}

	console.log(`Successfully updated ${updatedCount} users with full information`);
	return updatedCount;
}

async function getMostRecentStarredAt(): Promise<Date | null> {
	const [result] = await db
		.select({ starredAt: githubRepositories.starredAt })
		.from(githubRepositories)
		.orderBy(desc(githubRepositories.starredAt))
		.limit(1);

	return result?.starredAt ?? null;
}

async function syncStarredRepos(octokit: Octokit, integrationRunId: number): Promise<number> {
	console.log('Fetching GitHub starred repos...');

	const mostRecentStarredAt = await getMostRecentStarredAt();
	if (mostRecentStarredAt) {
		console.log(`Most recent star in database: ${mostRecentStarredAt.toISOString()}`);
	} else {
		console.log('No existing stars in database');
	}

	let page = 1;
	let hasMore = true;
	let totalStars = 0;

	while (hasMore) {
		try {
			console.log(`Fetching page ${page}...`);
			const response = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
				mediaType: {
					format: 'vnd.github.star+json',
				},
				per_page: PAGE_SIZE,
				page,
			});

			logRateLimitInfo(response);
			const parsedResponse = GithubStarredReposResponseSchema.parse(response);

			if (parsedResponse.data.length === 0) {
				hasMore = false;
				break;
			}

			// Check if we've hit stars older than our most recent
			if (mostRecentStarredAt) {
				const oldestStarOnPage = parsedResponse.data.reduce(
					(oldest, star) => (star.starred_at < oldest ? star.starred_at : oldest),
					parsedResponse.data[0].starred_at
				);
				if (oldestStarOnPage <= mostRecentStarredAt) {
					console.log(
						`Reached stars older than ${mostRecentStarredAt.toISOString()}, stopping pagination`
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

				// First insert/get the owner
				const owner: NewGithubUser = {
					id: repo.owner.id,
					login: repo.owner.login,
					nodeId: repo.owner.node_id,
					htmlUrl: repo.owner.html_url,
					avatarUrl: repo.owner.avatar_url,
					type: repo.owner.type,
					partial: true,
					integrationRunId,
				};

				await db.insert(githubUsers).values(owner).onConflictDoNothing();

				// Then insert the repository
				const newRepo: NewGithubRepository = {
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

				await db.insert(githubRepositories).values(newRepo).onConflictDoUpdate({
					target: githubRepositories.id,
					set: newRepo,
				});

				totalStars++;
			}

			console.log(`Processed new stars from page ${page}`);

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
			}
			throw error;
		}
	}

	console.log(`Successfully synced ${totalStars} new starred repositories`);
	return totalStars;
}
export async function syncGitHubStars(integrationRunId: number): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	// First sync all starred repos
	const totalStars = await syncStarredRepos(octokit, integrationRunId);

	// Then update partial users
	await updatePartialUsers(octokit);

	return totalStars;
}
