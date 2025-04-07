import { db } from '@/server/db/connections';
import {
	raindropBookmarks,
	raindropCollections,
	raindropImages,
	RaindropType,
	type RaindropBookmarkInsert,
	type RaindropCollectionInsert,
} from '@/server/db/schema/raindrop';
import { runIntegration } from '../common/run-integration';
import {
	createMediaFromRaindropBookmarks,
	createRaindropTags,
	createRecordsFromRaindropBookmarks,
	createRecordsFromRaindropTags,
} from './map';
import { CollectionsResponseSchema, RaindropResponseSchema } from './types';
import type { Raindrop } from './types';

/**
 * Configuration constants
 */
const API_BASE_URL = 'https://api.raindrop.io/rest/v1';
const RAINDROPS_PAGE_SIZE = 50;

/**
 * Synchronizes Raindrop collections with the database
 *
 * This function:
 * 1. Fetches root collections from the Raindrop API
 * 2. Fetches child collections from the Raindrop API
 * 3. Combines and processes all collections
 * 4. Inserts or updates collections in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed collections
 * @throws Error if API requests fail
 */
async function syncCollections(integrationRunId: number): Promise<number> {
	let successCount = 0;

	try {
		// Step 1: Fetch root collections
		console.log('Fetching root collections...');
		const rootCollections = await fetchRaindropCollections(`${API_BASE_URL}/collections`);

		// Step 2: Fetch child collections
		console.log('Fetching child collections...');
		const childCollections = await fetchRaindropCollections(
			`${API_BASE_URL}/collections/childrens`
		);

		// Step 3: Combine and process collections
		const allCollections = [...rootCollections, ...childCollections];
		console.log(`Retrieved ${allCollections.length} total collections`);

		// Step 4: Insert or update collections in database
		console.log('Inserting collections to database...');
		successCount = await processCollections(allCollections, integrationRunId);

		console.log(
			`Successfully processed ${successCount} out of ${allCollections.length} collections`
		);
		return successCount;
	} catch (error) {
		console.error('Error syncing Raindrop collections:', error);
		throw error;
	}
}

/**
 * Fetches collections from the Raindrop API
 *
 * @param url - The API endpoint URL
 * @returns Array of collection items
 * @throws Error if the API request fails
 */
async function fetchRaindropCollections(url: string) {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Collections API request failed with status ${response.status}`);
	}

	const data = await response.json();
	const parsed = CollectionsResponseSchema.parse(data);
	return parsed.items;
}

/**
 * Processes and stores collections in the database
 *
 * @param collections - The collections to process
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed collections
 */
async function processCollections(
	collections: ReturnType<typeof fetchRaindropCollections> extends Promise<infer T> ? T : never,
	integrationRunId: number
): Promise<number> {
	let successCount = 0;

	for (const collection of collections) {
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
				integrationRunId,
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
				collectionId: collection._id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return successCount;
}

/**
 * Synchronizes Raindrop bookmarks with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new raindrops from the API
 * 3. Processes and stores the raindrops
 * 4. Creates related entities (tags, records, media)
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed raindrops
 * @throws Error if API requests fail
 */
async function syncRaindrops(integrationRunId: number): Promise<number> {
	console.log('Starting Raindrop bookmarks sync...');

	try {
		// Step 1: Determine last sync point
		const lastKnownDate = await getLastSyncDate();
		console.log(`Last known raindrop date: ${lastKnownDate?.toLocaleString() ?? 'none'}`);

		// Step 2: Fetch new raindrops
		const newRaindrops = await fetchNewRaindrops(lastKnownDate);
		console.log(`Found ${newRaindrops.length} new raindrops to process`);

		// Step 3: Process and store raindrops
		const successCount = await processRaindrops(newRaindrops, integrationRunId);
		console.log(`Successfully processed ${successCount} out of ${newRaindrops.length} raindrops`);

		// Step 4: Create related entities
		console.log('Creating related entities...');
		await createRelatedEntities(integrationRunId);

		return successCount;
	} catch (error) {
		console.error('Error syncing Raindrop bookmarks:', error);
		throw error;
	}
}

/**
 * Gets the date of the most recently updated raindrop
 *
 * @returns The date of the most recent raindrop, or undefined if none exists
 */
async function getLastSyncDate(): Promise<Date | undefined> {
	const latestRaindrop = await db.query.raindropBookmarks.findFirst({
		columns: {
			contentUpdatedAt: true,
		},
		orderBy: {
			contentUpdatedAt: 'desc',
		},
	});

	return latestRaindrop?.contentUpdatedAt ?? undefined;
}

/**
 * Fetches new raindrops from the Raindrop API
 *
 * @param lastKnownDate - The date of the most recent raindrop in the database
 * @returns Array of new raindrops
 */
async function fetchNewRaindrops(lastKnownDate?: Date): Promise<Raindrop[]> {
	let newRaindrops: Raindrop[] = [];
	let page = 0;
	let hasMore = true;
	let totalFetched = 0;

	while (hasMore) {
		console.log(`Fetching page ${page + 1}...`);
		const url = `${API_BASE_URL}/raindrops/0?perpage=${RAINDROPS_PAGE_SIZE}&page=${page}`;

		const response = await fetch(url, {
			headers: {
				Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Raindrops API request failed with status ${response.status}`);
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
			hasMore = parsedData.items.length === RAINDROPS_PAGE_SIZE;
		}

		totalFetched += parsedData.items.length;
		console.log(`Processed ${parsedData.items.length} raindrops (total: ${totalFetched})`);
		page++;
	}

	return newRaindrops;
}

/**
 * Processes and stores raindrops in the database
 *
 * @param raindrops - The raindrops to process
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed raindrops
 */
async function processRaindrops(raindrops: Raindrop[], integrationRunId: number): Promise<number> {
	// Insert raindrops one by one
	console.log(`Inserting ${raindrops.length} raindrops...`);
	let successCount = 0;

	await db.transaction(async (tx) => {
		for (const raindrop of raindrops) {
			try {
				const coverImageUrl = raindrop.cover;
				const bookmarkId = raindrop._id;

				const insertData: RaindropBookmarkInsert = {
					id: bookmarkId,
					linkUrl: raindrop.link,
					title: raindrop.title,
					excerpt: raindrop.excerpt,
					note: raindrop.note,
					type: RaindropType.parse(raindrop.type),
					tags: raindrop.tags.length > 0 ? raindrop.tags : null,
					important: raindrop.important,
					domain: raindrop.domain,
					collectionId: raindrop.collection.$id > 0 ? raindrop.collection.$id : null,
					contentCreatedAt: raindrop.created,
					contentUpdatedAt: raindrop.lastUpdate,
					integrationRunId,
				};

				await tx
					.insert(raindropBookmarks)
					.values(insertData)
					.onConflictDoUpdate({
						target: raindropBookmarks.id,
						set: { ...insertData, recordUpdatedAt: new Date() },
					});

				if (coverImageUrl) {
					const [coverImage] = await tx
						.insert(raindropImages)
						.values({
							url: coverImageUrl,
							bookmarkId,
						})
						.returning();
					if (!coverImage) {
						throw new Error('Failed to insert cover image');
					}
				}

				successCount++;
				if (successCount % 10 === 0) {
					console.log(`Processed ${successCount} of ${raindrops.length} raindrops`);
				}
			} catch (error) {
				console.error('Error processing raindrop:', {
					raindropId: raindrop._id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
	});

	return successCount;
}

/**
 * Creates related entities from raindrop data
 *
 * @param integrationRunId - The ID of the current integration run
 */
async function createRelatedEntities(integrationRunId: number): Promise<void> {
	// Create tags from raindrops
	await createRaindropTags(integrationRunId);

	// Create media from bookmarks
	await createMediaFromRaindropBookmarks();
	// Create records from tags
	await createRecordsFromRaindropTags();
	// Create main records
	await createRecordsFromRaindropBookmarks();
}

/**
 * Orchestrates the Raindrop data synchronization process
 *
 * This function coordinates the execution of multiple Raindrop integration steps:
 * 1. Syncs collections
 * 2. Syncs bookmarks (raindrops)
 *
 * Each step is wrapped in the runIntegration utility to track execution.
 */
async function syncRaindropData(): Promise<void> {
	try {
		console.log('Starting Raindrop data synchronization');

		// Step 1: Sync collections
		await runIntegration('raindrop', syncCollections);

		// Step 2: Sync bookmarks
		await runIntegration('raindrop', syncRaindrops);

		console.log('Raindrop data synchronization completed successfully');
	} catch (error) {
		console.error('Error syncing Raindrop data:', error);
		throw error;
	}
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING RAINDROP SYNC ===\n');
		await syncRaindropData();
		console.log('\n=== RAINDROP SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Raindrop sync main function:', error);
		console.log('\n=== RAINDROP SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncRaindropData };
