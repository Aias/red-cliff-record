import { Octokit } from '@octokit/rest';
import { createPgConnection } from '@schema/connections';
import { IntegrationType, commits, commitChanges, CommitChangeStatus, RunType } from '@schema/main';
import { runIntegration } from '@utils/run-integration';
import { desc, sql } from 'drizzle-orm';

const db = createPgConnection();

async function fetchIncrementalCommits(integrationRunId: number): Promise<number> {
	// Get the most recent commit date from the database
	const latestCommit = await db
		.select({ commitDate: commits.commitDate })
		.from(commits)
		.orderBy(desc(commits.commitDate))
		.limit(1);

	const lastKnownDate = latestCommit[0]?.commitDate;
	console.log(`Last known commit date: ${lastKnownDate?.toISOString() ?? 'none'}`);

	const MAX_SEARCH_RESULTS = 1000;
	const PAGE_SIZE = 50;
	let page = 1;
	let commitCount = 0;
	let hasMoreCommits = true;
	let reachedExistingCommit = false;

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	try {
		const { data: user } = await octokit.rest.users.getAuthenticated();
		const username = user.login;

		console.log(`Starting to fetch new commits for user: ${username}`);

		while (hasMoreCommits && !reachedExistingCommit && commitCount < MAX_SEARCH_RESULTS) {
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
						const commitDate = new Date(item.commit.committer?.date ?? item.commit.author?.date);

						// Skip processing if we've reached commits older than our last known date
						if (lastKnownDate && commitDate <= lastKnownDate) {
							return null;
						}

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
							commitDate,
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

				// Filter out null values and check if we've reached existing commits
				const validCommits = commitsData.filter((commit) => commit !== null);
				if (validCommits.length < commitsData.length) {
					reachedExistingCommit = true;
					console.log('Reached existing commits, stopping fetch.');
				}

				console.log(`Found ${validCommits.length} new commits from page ${page}.`);

				// Insert new commits into the database
				for (const commit of validCommits) {
					// Check if commit already exists
					const existingCommit = await db
						.select({ id: commits.id })
						.from(commits)
						.where(sql`${commits.sha} = ${commit.sha}`)
						.limit(1);

					if (existingCommit.length === 0) {
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
				}

				// Check if there are more commits to fetch
				hasMoreCommits = searchResponse.data.items.length === PAGE_SIZE;
				page++;
			} catch (error) {
				const err = error as { status: number; message: string };
				if (err.status === 403 && err.message.includes('secondary rate limit')) {
					console.warn('Secondary rate limit hit, retrying after delay...');
					await new Promise((resolve) => setTimeout(resolve, 60000));
				} else {
					throw error;
				}
			}
		}

		console.log(`Successfully inserted ${commitCount} new commits into the database.`);
		return commitCount;
	} catch (error) {
		console.error('Error fetching commits:', error);
		return commitCount;
	}
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.GITHUB, fetchIncrementalCommits, RunType.INCREMENTAL);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./update-commits.ts')) {
	main();
}

export { main as updateCommits };
