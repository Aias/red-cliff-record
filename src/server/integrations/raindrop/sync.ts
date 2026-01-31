import {
  raindropBookmarks,
  raindropCollections,
  raindropImages,
  RaindropTypeSchema,
  type RaindropBookmarkInsert,
  type RaindropCollectionInsert,
} from '@hozo';
import { db } from '@/server/db/connections/postgres';
import { createDebugContext } from '../common/debug-output';
import { requireEnv } from '../common/env';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import {
  createMediaFromRaindropBookmarks,
  createRaindropTags,
  createRecordsFromRaindropBookmarks,
  createRecordsFromRaindropTags,
} from './map';
import type { Raindrop } from './types';
import { CollectionsResponseSchema, RaindropResponseSchema } from './types';

/**
 * Configuration constants
 */
const API_BASE_URL = 'https://api.raindrop.io/rest/v1';
const RAINDROPS_PAGE_SIZE = 50;
const RAINDROP_TOKEN = requireEnv('RAINDROP_TEST_TOKEN');
const logger = createIntegrationLogger('raindrop', 'sync');

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
 * @param collectDebugData - Optional array to collect raw API data for debugging
 * @returns The number of successfully processed collections
 * @throws Error if API requests fail
 */
async function syncCollections(
  integrationRunId: number,
  collectDebugData?: unknown[]
): Promise<number> {
  let successCount = 0;

  try {
    // Step 1: Fetch root collections
    logger.start('Fetching root collections');
    const rootCollections = await fetchRaindropCollections(`${API_BASE_URL}/collections`);

    // Step 2: Fetch child collections
    logger.info('Fetching child collections');
    const childCollections = await fetchRaindropCollections(
      `${API_BASE_URL}/collections/childrens`
    );

    // Step 3: Combine and process collections
    const allCollections = [...rootCollections, ...childCollections];
    logger.info(`Retrieved ${allCollections.length} total collections`);

    // Collect debug data if requested
    if (collectDebugData) {
      collectDebugData.push(...allCollections);
    }

    // Step 4: Insert or update collections in database
    logger.info('Inserting collections to database');
    successCount = await processCollections(allCollections, integrationRunId);

    logger.complete('Processed collections', successCount);
    return successCount;
  } catch (error) {
    logger.error('Error syncing Raindrop collections', error);
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
      Authorization: `Bearer ${RAINDROP_TOKEN}`,
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
      logger.error('Error processing collection', {
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
 * @param collectDebugData - Optional array to collect raw API data for debugging
 * @returns The number of successfully processed raindrops
 * @throws Error if API requests fail
 */
async function syncRaindrops(
  integrationRunId: number,
  collectDebugData?: unknown[]
): Promise<number> {
  logger.start('Syncing Raindrop bookmarks');

  try {
    // Step 1: Determine last sync point
    const lastKnownDate = await getLastSyncDate();
    logger.info(`Last known raindrop date: ${lastKnownDate?.toLocaleString() ?? 'none'}`);

    // Step 2: Fetch new raindrops
    const newRaindrops = await fetchNewRaindrops(lastKnownDate);
    logger.info(`Found ${newRaindrops.length} new raindrops to process`);

    // Collect debug data if requested
    if (collectDebugData) {
      collectDebugData.push(...newRaindrops);
    }

    // Step 3: Process and store raindrops
    const successCount = await processRaindrops(newRaindrops, integrationRunId);
    logger.complete('Processed raindrops', successCount);

    // Step 4: Create related entities
    logger.info('Creating related entities');
    await createRelatedEntities(integrationRunId);

    return successCount;
  } catch (error) {
    logger.error('Error syncing Raindrop bookmarks', error);
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
  const RETRY_BASE = 1000;

  while (hasMore) {
    logger.info(`Fetching page ${page + 1}`);
    const url = `${API_BASE_URL}/raindrops/0?perpage=${RAINDROPS_PAGE_SIZE}&page=${page}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${RAINDROP_TOKEN}`,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retry = parseInt(response.headers.get('Retry-After') || '1', 10);
        logger.warn(`Rate limit hit, retrying in ${retry} seconds`);
        await new Promise((r) => setTimeout(r, retry * RETRY_BASE));
        continue;
      }
      if (response.status >= 500) {
        logger.warn(`Server error ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, RETRY_BASE));
        continue;
      }
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
    logger.info(`Processed ${parsedData.items.length} raindrops (total: ${totalFetched})`);
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
  logger.info(`Inserting ${raindrops.length} raindrops`);
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
          type: RaindropTypeSchema.parse(raindrop.type),
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
          logger.info(`Processed ${successCount} of ${raindrops.length} raindrops`);
        }
      } catch (error) {
        logger.error('Error processing raindrop', {
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
 * Fetches all raindrop data from API (collections and bookmarks) without persisting
 *
 * @param debugData - Object to collect raw API data
 */
async function fetchRaindropDataOnly(debugData: {
  collections: unknown[];
  raindrops: unknown[];
}): Promise<void> {
  // Fetch collections
  logger.info('Fetching root collections');
  const rootCollections = await fetchRaindropCollections(`${API_BASE_URL}/collections`);
  logger.info('Fetching child collections');
  const childCollections = await fetchRaindropCollections(`${API_BASE_URL}/collections/childrens`);
  const allCollections = [...rootCollections, ...childCollections];
  debugData.collections.push(...allCollections);
  logger.info(`Fetched ${allCollections.length} collections`);

  // Fetch raindrops
  logger.info('Fetching raindrops');
  const raindrops = await fetchNewRaindrops();
  debugData.raindrops.push(...raindrops);
  logger.info(`Fetched ${raindrops.length} raindrops`);
}

/**
 * Orchestrates the Raindrop data synchronization process
 *
 * This function coordinates the execution of multiple Raindrop integration steps:
 * 1. Syncs collections
 * 2. Syncs bookmarks (raindrops)
 *
 * Each step is wrapped in the runIntegration utility to track execution.
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 */
async function syncRaindropData(debug = false): Promise<void> {
  const debugContext = createDebugContext('raindrop', debug, {
    collections: [] as unknown[],
    raindrops: [] as unknown[],
  });
  try {
    if (debug) {
      // Debug mode: fetch data and output to .temp/ only, skip database writes
      logger.start('Starting Raindrop data fetch (debug mode - no database writes)');
      if (debugContext.data) {
        await fetchRaindropDataOnly(debugContext.data);
      }
      logger.complete('Raindrop data fetch completed (debug mode)');
    } else {
      // Normal mode: full sync with database writes
      logger.start('Starting Raindrop data synchronization');

      // Step 1: Sync collections
      await runIntegration('raindrop', (runId) =>
        syncCollections(runId, debugContext.data?.collections)
      );

      // Step 2: Sync bookmarks
      await runIntegration('raindrop', (runId) =>
        syncRaindrops(runId, debugContext.data?.raindrops)
      );

      logger.complete('Raindrop data synchronization completed');
    }
  } catch (error) {
    logger.error('Error syncing Raindrop data', error);
    throw error;
  } finally {
    await debugContext.flush().catch((flushError) => {
      logger.error('Failed to write debug output for Raindrop', flushError);
    });
  }
}

export { syncRaindropData };
