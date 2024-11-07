import { Octokit } from '@octokit/rest';
import fs from 'fs/promises';
import path from 'path';

async function fetchUserCommits() {
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	try {
		const { data: user } = await octokit.rest.users.getAuthenticated();
		const username = user.login;

		const PAGE_SIZE = 20;

		// First get the list of commits
		const searchResponse = await octokit.rest.search.commits({
			q: `author:${username}`,
			sort: 'author-date',
			order: 'desc',
			per_page: PAGE_SIZE
		});

		// Get detailed information for each commit
		const commits = await Promise.all(
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
					commitDate: commitData.commit.committer?.date ?? commitData.commit.author?.date,
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

		commits.sort((a, b) => {
			const dateA = a.commitDate ?? '';
			const dateB = b.commitDate ?? '';
			return dateB.localeCompare(dateA);
		});

		const outputPath = path.join(__dirname, 'recent-user-commits.json');
		await fs.writeFile(outputPath, JSON.stringify(commits, null, 2));

		console.log('Recent commits saved to recent-user-commits.json');
	} catch (error) {
		console.error('Error fetching commits:', error);
	}
}

fetchUserCommits();
