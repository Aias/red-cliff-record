import { Octokit } from '@octokit/rest';
import { bookmarks, IntegrationType, integrationRuns } from '../../schema/main';
import { runIntegration } from '../utils/run-integration';
import { createPgConnection } from '../../connections';
import { eq, inArray } from 'drizzle-orm';

const db = createPgConnection();

const REQUEST_ACCEPT_HEADER = 'application/vnd.github.star+json';

async function processGithubStars(integrationRunId: number): Promise<number> {
	console.log('Cleaning up existing GitHub star entries...');
	// Clean up existing entries
	await db
		.delete(bookmarks)
		.where(
			inArray(
				bookmarks.integrationRunId,
				db
					.select({ id: integrationRuns.id })
					.from(integrationRuns)
					.where(eq(integrationRuns.integrationType, IntegrationType.GITHUB))
			)
		);
	console.log('Existing entries cleaned up');

	console.log('Initializing GitHub API client...');
	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	const stars = [];
	let page = 1;

	console.log('Starting to fetch starred repositories...');
	while (true) {
		console.log(`Fetching page ${page} of starred repositories...`);
		const response = await octokit.request('GET /user/starred', {
			per_page: 100,
			page: page,
			headers: {
				accept: REQUEST_ACCEPT_HEADER
			}
		});

		if (response.data.length === 0) break;

		console.log(`Processing ${response.data.length} stars from page ${page}...`);
		const chunk = response.data.map(({ starred_at, repo }: Record<string, any>) => ({
			url: repo.html_url,
			title: repo.full_name,
			content: repo.description?.trim() || null,
			createdAt: new Date(starred_at),
			type: 'repository',
			category: 'Code',
			tags: repo.topics,
			imageUrl: repo?.owner?.avatar_url,
			integrationRunId
		}));

		console.log(`Inserting ${chunk.length} stars into database...`);
		await db.insert(bookmarks).values(chunk);
		stars.push(...chunk);
		page++;
	}

	console.log(`Finished processing ${stars.length} total starred repositories`);
	return stars.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.GITHUB, processGithubStars);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed-stars.ts')) {
	main();
}

export { main as seedGithubStars };
