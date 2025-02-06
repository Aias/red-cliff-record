import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { desc, isNotNull } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import { githubRepositories, type GithubRepositoryInsert } from '~/server/db/schema/github';
import { logRateLimitInfo } from '../common/log-rate-limit-info';
import { ensureGithubUserExists } from './sync-users';
import { GithubStarredReposResponseSchema } from './types';

const PAGE_SIZE = 50;

async function getMostRecentStarredAt(): Promise<Date | null> {
	const result = await db.query.githubRepositories.findFirst({
		columns: {
			starredAt: true,
		},
		where: isNotNull(githubRepositories.starredAt),
		orderBy: desc(githubRepositories.starredAt),
	});

	return result?.starredAt ?? null;
}

export async function syncGitHubStars(integrationRunId: number): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	console.log('Fetching GitHub starred repos...');

	const mostRecentStarredAt = await getMostRecentStarredAt();
	if (mostRecentStarredAt) {
		console.log(`Most recent star in database: ${mostRecentStarredAt.toLocaleString()}`);
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
					parsedResponse.data[0]!.starred_at
				);
				if (oldestStarOnPage <= mostRecentStarredAt) {
					console.log(
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
							embedding: null,
							archivedAt: null,
							recordUpdatedAt: new Date(),
						},
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
