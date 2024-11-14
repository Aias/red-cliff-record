import { createPgConnection } from '@schema/connections';
import { IntegrationType, bookmarks, RunType, integrationRuns } from '@schema/main';
import { desc, eq } from 'drizzle-orm';
import { runIntegration } from '@utils/run-integration';
import type { Raindrop, RaindropResponse } from './types';
import { getAllCollections } from './loaders';

const db = createPgConnection();

async function fetchIncrementalRaindrops(integrationRunId: number): Promise<number> {
	console.log('Starting Raindrop incremental update...');

	// Get the most recent bookmark date from the database
	const latestBookmark = await db
		.select({ bookmarkedAt: bookmarks.bookmarkedAt })
		.from(bookmarks)
		.leftJoin(integrationRuns, eq(bookmarks.integrationRunId, integrationRuns.id))
		.where(eq(integrationRuns.integrationType, IntegrationType.RAINDROP))
		.orderBy(desc(bookmarks.bookmarkedAt))
		.limit(1);

	const lastKnownDate = latestBookmark[0]?.bookmarkedAt;
	console.log(`Last known bookmark date: ${lastKnownDate?.toISOString() ?? 'none'}`);

	// Get collections first
	const collectionsMap = await getAllCollections();
	console.log(`Built collections map with ${collectionsMap.size} entries`);

	let newRaindrops: Raindrop[] = [];
	let page = 0;
	let hasMore = true;
	let totalFetched = 0;

	while (hasMore) {
		console.log(`📥 Fetching page ${page + 1}...`);
		const response = await fetch(
			`https://api.raindrop.io/rest/v1/raindrops/0?perpage=50&page=${page}`,
			{
				headers: {
					Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
				}
			}
		);

		if (!response.ok) {
			throw new Error(`API request failed with status ${response.status}`);
		}

		const data = (await response.json()) as RaindropResponse;

		// Check if we've reached bookmarks older than our last known date
		const reachedExisting = data.items.some(
			(item) => lastKnownDate && new Date(item.created) <= lastKnownDate
		);

		if (reachedExisting) {
			// Filter out any items that are older than our last known date
			const newItems = data.items.filter(
				(item) => !lastKnownDate || new Date(item.created) > lastKnownDate
			);
			newRaindrops = [...newRaindrops, ...newItems];
			hasMore = false;
		} else {
			newRaindrops = [...newRaindrops, ...data.items];
			hasMore = data.items.length === 50;
		}

		totalFetched += data.items.length;
		console.log(`✅ Processed ${data.items.length} raindrops (total: ${totalFetched})`);
		page++;
	}

	console.log(`🎉 Found ${newRaindrops.length} new raindrops to process`);

	// Convert raindrops to bookmark format
	const bookmarkData = newRaindrops.map((raindrop) => ({
		url: raindrop.link,
		title: raindrop.title,
		content: raindrop.excerpt?.trim() || null,
		notes: raindrop.note?.trim() || null,
		type: raindrop.type,
		category:
			raindrop.collectionId === -1
				? 'Unsorted'
				: collectionsMap.get(raindrop.collectionId) ||
					`Unknown Collection ${raindrop.collectionId}`,
		tags: raindrop.tags,
		important: raindrop.important,
		imageUrl: raindrop.cover,
		bookmarkedAt: new Date(raindrop.created),
		integrationRunId
	}));

	// Insert new bookmarks in chunks
	console.log(`Inserting ${bookmarkData.length} new bookmarks`);
	const chunkSize = 100;
	for (let i = 0; i < bookmarkData.length; i += chunkSize) {
		const chunk = bookmarkData.slice(i, i + chunkSize);
		await db
			.insert(bookmarks)
			.values(chunk)
			.onConflictDoNothing({ target: [bookmarks.url, bookmarks.bookmarkedAt] });
		console.log(
			`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(bookmarkData.length / chunkSize)}`
		);
	}

	console.log('All new bookmarks inserted successfully');
	return bookmarkData.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.RAINDROP, fetchIncrementalRaindrops, RunType.INCREMENTAL);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./update.ts')) {
	main();
}

export { main as updateRaindrops };
