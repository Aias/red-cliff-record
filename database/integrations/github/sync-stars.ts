import { Octokit } from '@octokit/rest';
import { stars as starsTable } from '@schema/main/github';
import { integrationRuns, IntegrationType } from '@schema/main/integrations';
import { runIntegration } from '@utils/run-integration';
import { createPgConnection } from '@schema/connections';
import { desc, like, eq } from 'drizzle-orm';
import type { StarredRepo } from './types';
const db = createPgConnection();

const REQUEST_ACCEPT_HEADER = 'application/vnd.github.star+json';

async function syncStars(integrationRunId: number): Promise<number> {
	console.log('Starting GitHub stars incremental update...');

	// Get the most recent bookmark date from the database
	const latestStarredRepo = await db
		.select({ starredAt: starsTable.starredAt })
		.from(starsTable)
		.leftJoin(integrationRuns, eq(starsTable.integrationRunId, integrationRuns.id))
		.where(eq(integrationRuns.integrationType, IntegrationType.enum.github))
		.orderBy(desc(starsTable.starredAt))
		.limit(1);

	const lastKnownDate = latestStarredRepo[0]?.starredAt;
	console.log(`Date of last starred repository: ${lastKnownDate?.toISOString() ?? 'none'}`);

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	const rawData: any = [];

	const starsToInsert: (typeof starsTable.$inferInsert)[] = [];
	let page = 1;
	let hasMore = true;
	let skippedCount = 0;

	while (hasMore) {
		console.log(`Fetching page ${page} of starred repositories...`);
		const response = await octokit.request('GET /user/starred', {
			per_page: 100,
			page: page,
			headers: {
				accept: REQUEST_ACCEPT_HEADER
			}
		});

		rawData.push(response.data);

		const data = response.data as unknown as StarredRepo[];
		if (data.length === 0) break;

		// Check if we've reached stars older than our last known date
		const reachedExisting = data.some(
			(star) => lastKnownDate && new Date(star.starred_at) <= lastKnownDate
		);

		for (const star of data) {
			// Skip if this star is older than our last known date
			if (lastKnownDate && new Date(star.starred_at) <= lastKnownDate) {
				skippedCount++;
				continue;
			}

			// Check if this star already exists in the database
			const existingBookmark = await db
				.select({ id: starsTable.id })
				.from(starsTable)
				.where(like(starsTable.repoUrl, star.repo.html_url))
				.limit(1);

			if (existingBookmark.length > 0) {
				skippedCount++;
				continue;
			}

			const { starred_at, repo } = star;

			starsToInsert.push({
				id: repo.id,
				repoUrl: repo.html_url,
				homepageUrl: repo.homepage,
				name: repo.name,
				fullName: repo.full_name,
				ownerLogin: repo.owner.login,
				licenseName: repo.license?.name,
				description: repo.description,
				language: repo.language,
				topics: repo.topics,
				starredAt: new Date(starred_at),
				integrationRunId
			});
		}

		if (reachedExisting) {
			hasMore = false;
		} else {
			page++;
		}
	}

	// Insert new stars in chunks
	if (starsToInsert.length > 0) {
		console.log(
			`Inserting ${starsToInsert.length} new stars (skipped ${skippedCount} existing stars)`
		);
		const chunkSize = 100;
		for (let i = 0; i < starsToInsert.length; i += chunkSize) {
			const chunk = starsToInsert.slice(i, i + chunkSize);
			await db.insert(starsTable).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(starsToInsert.length / chunkSize)}`
			);
		}
		console.log('New star rows inserted.');
	} else {
		console.log(`No new stars to insert (skipped ${skippedCount} existing stars)`);
	}

	return starsToInsert.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.enum.github, syncStars);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync-stars.ts')) {
	main();
}

export { main as updateGithubStars };
