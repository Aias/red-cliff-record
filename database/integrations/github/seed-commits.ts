import { Octokit } from '@octokit/rest';
import { createPgConnection } from '@schema/connections';
import { commits, commitChanges, CommitChangeStatus } from '@schema/main';
import { IntegrationType } from '@schema/main/integrations';
import { runIntegration } from '@utils/run-integration';

const db = createPgConnection();

async function fetchUserCommits(integrationRunId: number): Promise<number> {
	console.log(`Removing commits and alll history.`);
	await db.delete(commitChanges);
	await db.delete(commits);
	console.log('Cleanup complete');

	const MAX_SEARCH_RESULTS = 1000;
	const PAGE_SIZE = 50;
	let page = 1;
	let commitCount = 0;
	let hasMoreCommits = true;

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	try {
		const { data: user } = await octokit.rest.users.getAuthenticated();
		const username = user.login;

		console.log(`Starting to fetch commits for user: ${username}`);

		while (hasMoreCommits && commitCount < MAX_SEARCH_RESULTS) {
			console.log(`Fetching page ${page} of commits...`);

			try {
				// Get the list of commits for the current page
				const searchResponse = await octokit.rest.search.commits({
					q: `author:${username}`,
					sort: 'author-date',
					order: 'desc',
					per_page: PAGE_SIZE,
					page
				});

				const commitsData = await Promise.all(
					searchResponse.data.items.map(async (item) => {
						const [owner, repo] = item.repository.full_name.split('/');

						// Get detailed commit info
						const { data: commitData } = await octokit.rest.repos.getCommit({
							owner,
							repo,
							ref: item.sha
						});

						return {
							sha: commitData.sha,
							message: commitData.commit.message,
							repository: item.repository.full_name,
							url: commitData.html_url,
							committer: commitData.committer?.login,
							commitDate: new Date(item.commit.committer?.date ?? item.commit.author?.date),
							stats: commitData.stats,
							files: commitData.files?.map(
								({ filename, status, additions, deletions, changes, patch = '' }) => ({
									filename,
									status,
									additions,
									deletions,
									changes,
									patch:
										patch.length > 1000
											? `${patch.slice(0, 1000)}...<additional changes truncated>`
											: patch
								})
							)
						};
					})
				);

				console.log(`Fetched ${commitsData.length} commits from page ${page}.`);

				// Insert commits into the database
				for (const commit of commitsData) {
					const commitId = await db
						.insert(commits)
						.values({
							sha: commit.sha,
							message: commit.message,
							repository: commit.repository,
							url: commit.url,
							committer: commit.committer,
							commitDate: commit.commitDate,
							integrationRunId,
							additions: commit.stats?.additions ?? 0,
							deletions: commit.stats?.deletions ?? 0,
							changes: commit.stats?.total ?? 0
						})
						.returning();

					// Insert commit changes into the database
					if (commit.files) {
						const commitChangesData = commit.files.map((file) => ({
							filename: file.filename,
							status: file.status as CommitChangeStatus,
							patch: file.patch,
							commitId: commitId[0].id,
							additions: file.additions,
							deletions: file.deletions,
							changes: file.changes
						}));

						await db.insert(commitChanges).values(commitChangesData);
					}

					commitCount++;
				}

				// Check if there are more commits to fetch
				hasMoreCommits = searchResponse.data.items.length === PAGE_SIZE;
				page++;
			} catch (error) {
				const err = error as { status: number; message: string }; // Type assertion
				if (err.status === 403 && err.message.includes('secondary rate limit')) {
					console.warn('Secondary rate limit hit, retrying after delay...');
					await new Promise((resolve) => setTimeout(resolve, 60000)); // Wait for 1 minute
				} else {
					throw error;
				}
			}
		}

		console.log('Commits and their changes have been successfully inserted into the database.');
		return commitCount;
	} catch (error) {
		console.error('Error fetching commits:', error);
		return commitCount; // Return the number of commits successfully processed
	}
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.GITHUB, fetchUserCommits);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed-commits.ts')) {
	main();
}

export { main as seedCommits };
