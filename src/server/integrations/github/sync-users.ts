import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { githubUsers, type GithubUserInsert } from '@/server/db/schema/github';
import { logRateLimitInfo } from '../common/log-rate-limit-info';

/**
 * Configuration constants
 */
const REQUEST_DELAY_MS = 1000;

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
		id: number;
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
		id: userData.id,
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

	return userData.id;
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
 * @throws Error if the GitHub API request fails due to rate limiting
 */
export async function updatePartialUsers(): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	console.log('Fetching full user information for partial users...');

	// Find all users marked as partial
	const partialUsers = await db.query.githubUsers.findMany({
		where: {
			partial: true,
			deletedAt: {
				isNull: true,
			},
		},
	});

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

			// Log rate limit information for monitoring
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
					partial: false, // Mark as complete
					recordUpdatedAt: new Date(),
				})
				.where(eq(githubUsers.id, user.id));

			updatedCount++;
			console.log(`Updated user ${user.login}`);

			// Add a small delay between requests to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
		} catch (error) {
			if (error instanceof RequestError) {
				console.error(`Error fetching user ${user.login}:`, {
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

				// For other errors, continue with next user
				console.warn(`Skipping user ${user.login} due to error`);
				continue;
			}
			throw error;
		}
	}

	console.log(`Successfully updated ${updatedCount} users with full information`);
	return updatedCount;
}
