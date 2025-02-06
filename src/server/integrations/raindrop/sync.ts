import { desc } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	raindropBookmarks,
	raindropCollections,
	type RaindropBookmarkInsert,
	type RaindropCollectionInsert,
} from '~/server/db/schema/raindrop';
import { runIntegration } from '../common/run-integration';
import { CollectionsResponseSchema, RaindropResponseSchema } from './types';
import type { Raindrop } from './types';

async function syncCollections(integrationRunId: number) {
	let successCount = 0;

	console.log('📚 Fetching root collections...');
	const rootResponse = await fetch('https://api.raindrop.io/rest/v1/collections', {
		headers: {
			Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`,
		},
	});

	if (!rootResponse.ok) {
		throw new Error(`Root collections API request failed with status ${rootResponse.status}`);
	}

	const rootData = await rootResponse.json();
	const rootParsed = CollectionsResponseSchema.parse(rootData);

	console.log('👶 Fetching child collections...');
	const childrenResponse = await fetch('https://api.raindrop.io/rest/v1/collections/childrens', {
		headers: {
			Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`,
		},
	});

	if (!childrenResponse.ok) {
		throw new Error(`Child collections API request failed with status ${childrenResponse.status}`);
	}

	const childrenData = await childrenResponse.json();
	const childrenParsed = CollectionsResponseSchema.parse(childrenData);

	const allCollections = [...rootParsed.items, ...childrenParsed.items];
	console.log(`✅ Retrieved ${allCollections.length} total collections`);
	console.log('Inserting collections to database.');
	for (const collection of allCollections) {
		try {
			const collectionToInsert: RaindropCollectionInsert = {
				id: collection._id,
				title: collection.title,
				parentId: collection.parent?.$id,
				colorHex: collection.color,
				coverUrl: collection.cover[0],
				raindropCount: collection.count,
				contentCreatedAt: collection.created,
				contentUpdatedAt: collection.lastUpdate,
				integrationRunId: integrationRunId,
			};

			await db
				.insert(raindropCollections)
				.values(collectionToInsert)
				.onConflictDoUpdate({
					target: raindropCollections.id,
					set: { ...collectionToInsert, recordUpdatedAt: new Date() },
				});

			successCount++;
		} catch (error) {
			console.error('Error processing collection:', {
				collection,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	console.log(
		`✅ Successfully processed ${successCount} out of ${allCollections.length} collections`
	);

	return successCount;
}

async function syncRaindrops(integrationRunId: number) {
	console.log('Starting Raindrop sync...');

	// Get the most recent raindrop date from the database
	const latestRaindrop = await db.query.raindropBookmarks.findFirst({
		columns: {
			contentUpdatedAt: true,
		},
		orderBy: desc(raindropBookmarks.contentUpdatedAt),
	});

	const lastKnownDate = latestRaindrop?.contentUpdatedAt;
	console.log(`Last known raindrop date: ${lastKnownDate?.toLocaleString() ?? 'none'}`);

	let newRaindrops: Raindrop[] = [];
	let page = 0;
	let hasMore = true;
	let totalFetched = 0;
	const PAGE_SIZE = 50;

	while (hasMore) {
		console.log(`📥 Fetching page ${page + 1}...`);
		const response = await fetch(
			`https://api.raindrop.io/rest/v1/raindrops/0?perpage=${PAGE_SIZE}&page=${page}`,
			{
				headers: {
					Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`,
				},
			}
		);

		if (!response.ok) {
			throw new Error(`API request failed with status ${response.status}`);
		}

		const data = await response.json();
		const parsedData = RaindropResponseSchema.parse(data);

		// Check if we've reached raindrops older than our last known date
		const reachedExisting = parsedData.items.some(
			({ lastUpdate }) => lastKnownDate && lastUpdate <= lastKnownDate
		);

		if (reachedExisting) {
			// Filter out any items that are older than our last known date
			const newItems = parsedData.items.filter(
				({ lastUpdate }) => !lastKnownDate || lastUpdate > lastKnownDate
			);
			newRaindrops = [...newRaindrops, ...newItems];
			hasMore = false;
		} else {
			newRaindrops = [...newRaindrops, ...parsedData.items];
			hasMore = parsedData.items.length === PAGE_SIZE;
		}

		totalFetched += parsedData.items.length;
		console.log(`✅ Processed ${parsedData.items.length} raindrops (total: ${totalFetched})`);
		page++;
	}

	console.log(`🎉 Found ${newRaindrops.length} new raindrops to process`);

	// Convert raindrops to bookmark format
	const raindropsToInsert: RaindropBookmarkInsert[] = newRaindrops.map((raindrop) => ({
		id: raindrop._id,
		linkUrl: raindrop.link,
		title: raindrop.title,
		excerpt: raindrop.excerpt,
		note: raindrop.note,
		type: raindrop.type,
		coverImageUrl: raindrop.cover,
		tags: raindrop.tags.length > 0 ? raindrop.tags : null,
		important: raindrop.important,
		domain: raindrop.domain,
		collectionId: raindrop.collection.$id > 0 ? raindrop.collection.$id : null,
		contentCreatedAt: raindrop.created,
		contentUpdatedAt: raindrop.lastUpdate,
		integrationRunId,
	}));

	// Insert raindrops one by one
	console.log(`Inserting ${raindropsToInsert.length} new raindrops`);
	let successCount = 0;
	for (const raindrop of raindropsToInsert) {
		try {
			await db
				.insert(raindropBookmarks)
				.values(raindrop)
				.onConflictDoUpdate({
					target: raindropBookmarks.id,
					set: { ...raindrop, embedding: null, archivedAt: null, recordUpdatedAt: new Date() },
				});
			successCount++;
			if (successCount % 10 === 0) {
				console.log(`Processed ${successCount} of ${raindropsToInsert.length} raindrops`);
			}
		} catch (error) {
			console.error('Error processing raindrop:', {
				raindrop,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	console.log(
		`Successfully processed ${successCount} out of ${raindropsToInsert.length} raindrops`
	);

	console.log('All new raindrops inserted successfully');
	return successCount;
}

const main = async () => {
	try {
		await runIntegration('raindrop', syncCollections);
		await runIntegration('raindrop', syncRaindrops);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncRaindrops };
