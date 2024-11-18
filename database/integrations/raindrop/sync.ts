import { createPgConnection } from '@schema/connections';
import { raindrops, collections } from '@schema/main/raindrop';
import { integrationRuns, IntegrationType, RunType } from '@schema/main/integrations';
import { runIntegration } from '@utils/run-integration';
import type { CollectionsResponse, Raindrop, RaindropResponse } from './types';
import { eq, desc } from 'drizzle-orm';

const db = createPgConnection();

async function syncCollections(integrationRunId: number) {
	let successCount = 0;

	console.log('📚 Fetching root collections...');
	const rootResponse = await fetch('https://api.raindrop.io/rest/v1/collections', {
		headers: {
			Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
		}
	});

	if (!rootResponse.ok) {
		throw new Error(`Root collections API request failed with status ${rootResponse.status}`);
	}

	const rootData = (await rootResponse.json()) as CollectionsResponse;

	console.log('👶 Fetching child collections...');
	const childrenResponse = await fetch('https://api.raindrop.io/rest/v1/collections/childrens', {
		headers: {
			Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
		}
	});

	if (!childrenResponse.ok) {
		throw new Error(`Child collections API request failed with status ${childrenResponse.status}`);
	}

	const childrenData = (await childrenResponse.json()) as CollectionsResponse;

	const allCollections = [...rootData.items, ...childrenData.items];
	console.log(`✅ Retrieved ${allCollections.length} total collections`);

	for (const collection of allCollections) {
		console.log('Inserting collections to database.');
		try {
			const collectionToInsert: typeof collections.$inferInsert = {
				id: collection._id,
				title: collection.title,
				parentId: collection.parent?.$id,
				colorHex: collection.color,
				coverUrl: collection.cover[0],
				raindropCount: collection.count,
				createdAt: new Date(collection.created),
				updatedAt: new Date(collection.lastUpdate),
				integrationRunId: integrationRunId
			};

			await db.insert(collections).values(collectionToInsert).onConflictDoUpdate({
				target: collections.id,
				set: collectionToInsert
			});

			successCount++;
		} catch (error) {
			console.error('Error processing collection:', {
				collection,
				error: error instanceof Error ? error.message : String(error)
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
	const latestRaindrop = await db
		.select({ createdAt: raindrops.createdAt })
		.from(raindrops)
		.leftJoin(integrationRuns, eq(raindrops.integrationRunId, integrationRuns.id))
		.where(eq(integrationRuns.integrationType, IntegrationType.RAINDROP))
		.orderBy(desc(raindrops.createdAt))
		.limit(1);

	const lastKnownDate = latestRaindrop[0]?.createdAt;
	console.log(`Last known raindrop date: ${lastKnownDate?.toISOString() ?? 'none'}`);

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

		// Check if we've reached raindrops older than our last known date
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
	const raindropsToInsert: (typeof raindrops.$inferInsert)[] = newRaindrops.map((raindrop) => ({
		id: raindrop._id,
		linkUrl: raindrop.link,
		title: raindrop.title,
		excerpt: raindrop.excerpt?.trim() || null,
		note: raindrop.note?.trim() || null,
		type: raindrop.type,
		coverImageUrl: raindrop.cover,
		tags: raindrop.tags,
		important: raindrop.important,
		domain: raindrop.domain,
		collectionId: raindrop.collection?.$id > 0 ? raindrop.collection?.$id : null,
		createdAt: new Date(raindrop.created),
		updatedAt: new Date(raindrop.lastUpdate),
		integrationRunId
	}));

	// Insert raindrops one by one
	console.log(`Inserting ${raindropsToInsert.length} new raindrops`);
	let successCount = 0;
	for (const raindrop of raindropsToInsert) {
		try {
			await db.insert(raindrops).values(raindrop).onConflictDoUpdate({
				target: raindrops.id,
				set: raindrop
			});
			successCount++;
			if (successCount % 10 === 0) {
				console.log(`Processed ${successCount} of ${raindropsToInsert.length} raindrops`);
			}
		} catch (error) {
			console.error('Error processing raindrop:', {
				raindrop,
				error: error instanceof Error ? error.message : String(error)
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
		await runIntegration(IntegrationType.RAINDROP, syncCollections, RunType.INCREMENTAL);
		await runIntegration(IntegrationType.RAINDROP, syncRaindrops, RunType.INCREMENTAL);
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
