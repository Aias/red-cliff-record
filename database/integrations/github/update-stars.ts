import { Octokit } from '@octokit/rest';
import { bookmarks, integrationRuns, IntegrationType, RunType } from '@schema/main';
import { runIntegration } from '@utils/run-integration';
import { createPgConnection } from '@schema/connections';
import { desc, like, eq } from 'drizzle-orm';
import type { StarredRepo } from './types';

const db = createPgConnection();

const REQUEST_ACCEPT_HEADER = 'application/vnd.github.star+json';

async function processGithubStarsIncremental(integrationRunId: number): Promise<number> {
	console.log('Starting GitHub stars incremental update...');

	// Get the most recent bookmark date from the database
	const latestBookmark = await db
		.select({ bookmarkedAt: bookmarks.bookmarkedAt })
		.from(bookmarks)
		.leftJoin(integrationRuns, eq(bookmarks.integrationRunId, integrationRuns.id))
		.where(eq(integrationRuns.integrationType, IntegrationType.GITHUB))
		.orderBy(desc(bookmarks.bookmarkedAt))
		.limit(1);

	const lastKnownDate = latestBookmark[0]?.bookmarkedAt;
	console.log(`Last known bookmark date: ${lastKnownDate?.toISOString() ?? 'none'}`);

	const octokit = new Octokit({
		auth: process.env.GITHUB_TOKEN
	});

	const starsToInsert: (typeof bookmarks.$inferInsert)[] = [];
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
				.select({ id: bookmarks.id })
				.from(bookmarks)
				.where(like(bookmarks.url, star.repo.html_url))
				.limit(1);

			if (existingBookmark.length > 0) {
				skippedCount++;
				continue;
			}

			starsToInsert.push({
				url: star.repo.html_url,
				title: star.repo.name,
				creator: star.repo.owner.login,
				content: star.repo.description?.trim() || null,
				bookmarkedAt: new Date(star.starred_at),
				type: 'repository',
				category: 'Code',
				tags: star.repo.topics,
				imageUrl: star.repo.owner.avatar_url,
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
			await db.insert(bookmarks).values(chunk);
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
		await runIntegration(
			IntegrationType.GITHUB,
			processGithubStarsIncremental,
			RunType.INCREMENTAL
		);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./update-stars.ts')) {
	main();
}

export { main as updateGithubStars };
