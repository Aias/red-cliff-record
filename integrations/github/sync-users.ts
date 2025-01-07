import { type GithubUserInsert, githubUsers } from '@schema/integrations';
import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import { eq } from 'drizzle-orm';
import { logRateLimitInfo } from './helpers';
import { db } from '@/db/connections';

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
	// First insert basic user info
	const user: GithubUserInsert = {
		id: userData.id,
		login: userData.login,
		nodeId: userData.node_id,
		htmlUrl: userData.html_url,
		avatarUrl: userData.avatar_url,
		type: userData.type,
		partial: true,
		integrationRunId,
	};

	await db.insert(githubUsers).values(user).onConflictDoNothing();
	return userData.id;
}

export async function updatePartialUsers(): Promise<number> {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN,
	});

	console.log('Fetching full user information for partial users...');

	// Update this select statement to use Drizzle query syntax
	const partialUsers = await db.query.githubUsers.findMany({
		where: eq(githubUsers.partial, true),
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
