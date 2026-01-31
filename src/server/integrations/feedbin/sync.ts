import { feedEntries, feeds } from '@hozo';
import { inArray } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import {
  fetchEntriesByIds,
  fetchFeed,
  fetchIcons,
  fetchRecentlyReadEntryIds,
  fetchStarredEntryIds,
  fetchSubscriptions,
  fetchUnreadEntryIds,
  fetchUpdatedEntryIds,
} from './client';
import type { FeedbinEntry, FeedbinIcon, FeedbinSubscription } from './types';

const logger = createIntegrationLogger('feedbin', 'sync');

/** Concurrency for processing entries */
const ENTRY_CONCURRENCY = 30;

/**
 * Cache of synced feed IDs to avoid repeated fetches
 */
const syncedFeedIds = new Set<number>();

function buildIconMap(icons: FeedbinIcon[]): Map<string, string> {
  const iconMap = new Map<string, string>();
  for (const icon of icons) {
    iconMap.set(icon.host, icon.url);
  }
  return iconMap;
}

/**
 * Get the most recent feed entry IDs with read/starred status
 */
async function getRecentEntryStatuses(
  limit = 1000
): Promise<Map<number, { read: boolean; starred: boolean }>> {
  const rows = await db.query.feedEntries.findMany({
    columns: { id: true, read: true, starred: true },
    orderBy: { recordCreatedAt: 'desc' },
    limit,
  });
  return new Map(rows.map((r) => [r.id, { read: r.read, starred: r.starred }]));
}

/**
 * Get the most recent feed IDs
 */
async function getRecentFeedIds(limit = 1000): Promise<Set<number>> {
  const rows = await db.query.feeds.findMany({
    columns: { id: true },
    orderBy: { recordCreatedAt: 'desc' },
    limit,
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Get ALL existing entry IDs from the database
 */
async function getAllExistingEntryIds(): Promise<Set<number>> {
  const rows = await db.query.feedEntries.findMany({
    columns: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Bulk update read status for multiple entries
 */
async function bulkUpdateReadStatus(entryIds: number[], read: boolean): Promise<void> {
  if (entryIds.length === 0) return;

  const now = new Date();
  const BATCH_SIZE = 1000;
  const BATCH_TIMEOUT_MS = 30000; // 30 seconds per batch

  for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
    const batch = entryIds.slice(i, i + BATCH_SIZE);
    const batchStartTime = Date.now();

    logger.info(
      `Updating read status for batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} entries)`
    );

    try {
      await Promise.race([
        db
          .update(feedEntries)
          .set({ read, recordUpdatedAt: now })
          .where(inArray(feedEntries.id, batch)),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Bulk update timeout after ${BATCH_TIMEOUT_MS}ms`)),
            BATCH_TIMEOUT_MS
          )
        ),
      ]);

      const batchDuration = Date.now() - batchStartTime;
      logger.info(`Bulk update batch completed in ${batchDuration}ms`);
    } catch (error) {
      logger.error(`Bulk update batch failed or timed out`, error);
      // Continue with next batch even if this one fails
    }

    // Add small delay between batches
    if (i + BATCH_SIZE < entryIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Sync a single feed from Feedbin
 */
async function syncSingleFeed(feedId: number, iconMap?: Map<string, string>): Promise<void> {
  const FEED_TIMEOUT_MS = 15000; // 15 seconds per feed

  try {
    await Promise.race([
      (async () => {
        const feed = await fetchFeed(feedId);

        // Extract icon URL
        let iconUrl: string | null = null;
        if (feed.site_url) {
          try {
            if (iconMap) {
              const url = new URL(feed.site_url);
              iconUrl = iconMap.get(url.hostname) || null;
            }
          } catch {
            // Ignore URL parsing errors
          }
        }

        await db
          .insert(feeds)
          .values({
            id: feed.id,
            name: feed.title,
            feedUrl: feed.feed_url,
            siteUrl: feed.site_url,
            iconUrl,
            sources: ['feedbin'],
          })
          .onConflictDoUpdate({
            target: feeds.id,
            set: {
              name: feed.title,
              feedUrl: feed.feed_url,
              siteUrl: feed.site_url,
              iconUrl,
              recordUpdatedAt: new Date(),
            },
          });
      })(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Single feed sync timeout after ${FEED_TIMEOUT_MS}ms`)),
          FEED_TIMEOUT_MS
        )
      ),
    ]);
  } catch (error) {
    logger.warn(`Failed to sync feed ${feedId}`, error);
    throw error;
  }
}

/**
 * Sync feeds from Feedbin subscriptions
 */
async function syncFeeds(
  subscriptions: FeedbinSubscription[],
  iconMap: Map<string, string>,
  _integrationRunId: number
): Promise<void> {
  logger.start(`Syncing ${subscriptions.length} feeds`);

  const FEED_TIMEOUT_MS = 15000; // 15 seconds per feed
  let successCount = 0;
  let errorCount = 0;

  for (const [index, subscription] of subscriptions.entries()) {
    const feedStartTime = Date.now();

    try {
      // Set up timeout for individual feed processing
      await Promise.race([
        (async () => {
          // Extract domain from site URL for icon lookup
          const siteUrl = subscription.site_url;
          let iconUrl: string | null = null;

          if (siteUrl) {
            try {
              const url = new URL(siteUrl);
              iconUrl = iconMap.get(url.hostname) || null;
            } catch {
              // Ignore URL parsing errors
            }
          }

          // Upsert feed
          await db
            .insert(feeds)
            .values({
              id: subscription.feed_id,
              name: subscription.title,
              feedUrl: subscription.feed_url,
              siteUrl: subscription.site_url,
              iconUrl,
              sources: ['feedbin'],
              contentCreatedAt: subscription.created_at,
            })
            .onConflictDoUpdate({
              target: feeds.id,
              set: {
                name: subscription.title,
                feedUrl: subscription.feed_url,
                siteUrl: subscription.site_url,
                iconUrl,
                recordUpdatedAt: new Date(),
              },
            });
        })(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Feed sync timeout after ${FEED_TIMEOUT_MS}ms`)),
            FEED_TIMEOUT_MS
          )
        ),
      ]);

      successCount++;
      const feedDuration = Date.now() - feedStartTime;
      logger.info(
        `Synced feed "${subscription.title}" (${index + 1} of ${subscriptions.length}) in ${feedDuration}ms`
      );
    } catch (error) {
      errorCount++;
      logger.warn(
        `Failed to sync feed ${subscription.feed_id} (${index + 1} of ${subscriptions.length})`,
        error
      );
    }

    // Add small delay between feeds to prevent overwhelming the system
    if (index < subscriptions.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  logger.complete(`Synced ${successCount} feeds (${errorCount} errors)`);
}

/** Result of processing a single entry */
type EntryResult =
  | { status: 'success'; entryId: number }
  | { status: 'skipped'; entryId: number }
  | { status: 'error'; entryId: number; entry: FeedbinEntry };

/**
 * Process a single entry (for use with runConcurrentPool)
 */
async function processSingleEntry(
  entry: FeedbinEntry,
  unreadIds: Set<number>,
  starredIds: Set<number>,
  integrationRunId: number,
  updatedEntryIds: Set<number> | undefined
): Promise<EntryResult> {
  // Determine a usable URL for the entry
  const effectiveUrl = entry.url ?? entry.extracted_content_url ?? null;
  if (!effectiveUrl) {
    // Skip entries without any URL; database requires non-null URL
    logger.warn(
      `Skipping entry #${entry.id}: ${entry.title} (feed ${entry.feed_id}) because it has no URL`
    );
    return { status: 'skipped', entryId: entry.id };
  }

  // For updated entries, preserve existing read/starred status
  // For new entries, use the status from Feedbin
  const isUpdatedEntry = updatedEntryIds?.has(entry.id) ?? false;
  let isRead = !unreadIds.has(entry.id);
  let isStarred = starredIds.has(entry.id);

  if (isUpdatedEntry) {
    // Fetch current status from database for updated entries
    const existingEntry = await db.query.feedEntries.findFirst({
      where: {
        id: entry.id,
      },
      columns: { read: true, starred: true },
    });
    if (existingEntry) {
      isRead = existingEntry.read;
      isStarred = existingEntry.starred;
    }
  }

  // Extract image URLs from content if available
  let imageUrls: string[] | null = null;
  if (entry.images?.original_url) {
    imageUrls = [entry.images.original_url];
  }

  // Process enclosure - skip if it has invalid data
  let enclosure = null;
  if (entry.enclosure) {
    const enc = entry.enclosure;
    // Skip if enclosure_type is "false", false, null, or if URLs are objects
    if (
      enc.enclosure_type !== 'false' &&
      enc.enclosure_type !== false &&
      enc.enclosure_type !== null &&
      typeof enc.enclosure_url !== 'object' &&
      enc.enclosure_url !== null
    ) {
      let enclosureUrl = '';
      if (typeof enc.enclosure_url === 'string') {
        enclosureUrl = enc.enclosure_url;
      }

      let itunesImage = null;
      if (typeof enc.itunes_image === 'string') {
        itunesImage = enc.itunes_image;
      }

      if (enclosureUrl) {
        enclosure = {
          enclosureUrl,
          enclosureType: typeof enc.enclosure_type === 'string' ? enc.enclosure_type : '',
          enclosureLength: typeof enc.enclosure_length === 'number' ? enc.enclosure_length : 0,
          itunesDuration: enc.itunes_duration || null,
          itunesImage,
        };
      }
    }
  }

  // Upsert entry (without embedding - will be done in post-process)
  await db
    .insert(feedEntries)
    .values({
      id: entry.id,
      feedId: entry.feed_id,
      url: effectiveUrl,
      title: entry.title,
      author: entry.author,
      summary: entry.summary,
      content: entry.content,
      imageUrls,
      enclosure,
      read: isRead,
      starred: isStarred,
      publishedAt: entry.published,
      integrationRunId,
    })
    .onConflictDoUpdate({
      target: feedEntries.id,
      set: {
        title: entry.title,
        author: entry.author,
        summary: entry.summary,
        content: entry.content,
        imageUrls,
        enclosure,
        read: isRead,
        starred: isStarred,
        publishedAt: entry.published,
        recordUpdatedAt: new Date(),
      },
    });

  return { status: 'success', entryId: entry.id };
}

/** Retry delays for failed entries (exponential backoff: 1s, 2s, 4s) */
const RETRY_DELAYS = [1000, 2000, 4000];

/**
 * Process an entry with retry logic inside the worker
 */
async function processEntryWithRetry(
  entry: FeedbinEntry,
  unreadIds: Set<number>,
  starredIds: Set<number>,
  integrationRunId: number,
  updatedEntryIds: Set<number> | undefined
): Promise<EntryResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1];
      if (delay === undefined) {
        throw new Error(`Missing retry delay for attempt ${attempt}`);
      }
      logger.info(`Retry ${attempt}/${RETRY_DELAYS.length} for entry ${entry.id} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      return await processSingleEntry(
        entry,
        unreadIds,
        starredIds,
        integrationRunId,
        updatedEntryIds
      );
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt + 1} failed for entry ${entry.id}`, error);
    }
  }

  logger.error(`Failed to sync entry ${entry.id} after ${RETRY_DELAYS.length} retries`, lastError);
  return { status: 'error', entryId: entry.id, entry };
}

/**
 * Sync feed entries from Feedbin
 */
async function syncFeedEntries(
  entries: FeedbinEntry[],
  unreadIds: Set<number>,
  starredIds: Set<number>,
  integrationRunId: number,
  updatedEntryIds?: Set<number>
): Promise<number> {
  logger.start(`Syncing ${entries.length} entries`);

  const results = await runConcurrentPool({
    items: entries,
    concurrency: ENTRY_CONCURRENCY,
    timeoutMs: 30_000, // 30 seconds per entry (including retries)
    worker: async (entry) => {
      return processEntryWithRetry(entry, unreadIds, starredIds, integrationRunId, updatedEntryIds);
    },
    onProgress: (completed, total) => {
      if (completed % 50 === 0 || completed === total) {
        logger.info(`Progress: ${completed}/${total} entries processed`);
      }
    },
  });

  const successCount = results.filter((r) => r.ok && r.value.status === 'success').length;
  const skippedCount = results.filter((r) => r.ok && r.value.status === 'skipped').length;
  const errorCount = results.filter((r) => !r.ok || r.value.status === 'error').length;

  if (errorCount > 0) {
    logger.warn(`Failed to sync ${errorCount} entries after retry attempts`);
  }

  logger.complete(
    `Synced ${successCount} of ${entries.length} entries (${skippedCount} skipped, ${errorCount} errors)`
  );
  return successCount;
}

/**
 * Bulk update starred status for multiple entries
 */
async function bulkUpdateStarredStatus(entryIds: number[], starred: boolean): Promise<void> {
  if (entryIds.length === 0) return;

  const BATCH_SIZE = 1000;
  const BATCH_TIMEOUT_MS = 30000; // 30 seconds per batch

  for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
    const batch = entryIds.slice(i, i + BATCH_SIZE);
    const batchStartTime = Date.now();

    logger.info(
      `Updating starred status for batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} entries)`
    );

    try {
      await Promise.race([
        db.update(feedEntries).set({ starred }).where(inArray(feedEntries.id, batch)),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Bulk update timeout after ${BATCH_TIMEOUT_MS}ms`)),
            BATCH_TIMEOUT_MS
          )
        ),
      ]);

      const batchDuration = Date.now() - batchStartTime;
      logger.info(`Bulk update batch completed in ${batchDuration}ms`);
    } catch (error) {
      logger.error(`Bulk update batch failed or timed out`, error);
      // Continue with next batch even if this one fails
    }

    // Add small delay between batches
    if (i + BATCH_SIZE < entryIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

/**
 * Get the most recent feed update timestamp
 */
async function getLastFeedSyncTime(): Promise<Date | null> {
  const result = await db.query.feeds.findFirst({
    columns: {
      contentCreatedAt: true,
    },
    where: {
      contentCreatedAt: {
        isNotNull: true,
      },
    },
    orderBy: {
      contentCreatedAt: 'desc',
    },
  });

  return result?.contentCreatedAt || null;
}

/**
 * Get the most recent entry sync timestamp
 */
async function getLastEntrySyncTime(): Promise<Date | null> {
  const result = await db.query.integrationRuns.findFirst({
    columns: {
      runStartTime: true,
    },
    where: {
      integrationType: 'feedbin',
      status: 'success',
    },
    orderBy: {
      runStartTime: 'desc',
    },
  });

  return result?.runStartTime || null;
}

/**
 * Main sync function for Feedbin integration
 */
async function syncFeedbin(
  integrationRunId: number,
  collectDebugData?: { subscriptions: unknown[]; entries: unknown[]; icons: unknown[] }
): Promise<number> {
  try {
    // Clear the synced feed cache
    syncedFeedIds.clear();

    // Get existing IDs for recent entries and feeds
    const [existingEntryStatuses, existingFeedIds, allExistingEntryIds] = await Promise.all([
      getRecentEntryStatuses(),
      getRecentFeedIds(),
      getAllExistingEntryIds(),
    ]);

    // Step 1: Get last sync time and fetch new subscriptions
    const lastSyncTime = await getLastFeedSyncTime();
    logger.info(`Last feed sync: ${lastSyncTime?.toISOString() || 'never'}`);

    // Fetch subscriptions created since last sync
    const [newSubscriptions, icons] = await Promise.all([
      fetchSubscriptions(lastSyncTime || undefined),
      fetchIcons(),
    ]);
    const iconMap = buildIconMap(icons);

    // Collect debug data if requested
    if (collectDebugData) {
      collectDebugData.subscriptions.push(...newSubscriptions);
      collectDebugData.icons.push(...icons);
    }

    if (newSubscriptions.length > 0) {
      logger.info(`Syncing ${newSubscriptions.length} new subscriptions`);
      await syncFeeds(newSubscriptions, iconMap, integrationRunId);
    }

    // Step 2: Get last entry sync time for updated entries
    const lastEntrySyncTime = await getLastEntrySyncTime();
    logger.info(`Last entry sync: ${lastEntrySyncTime?.toISOString() || 'never'}`);

    // Step 3: Fetch entry IDs from Feedbin
    logger.start('Fetching entry IDs');
    const [unreadIds, starredIds, recentlyReadIds, updatedIds] = await Promise.all([
      fetchUnreadEntryIds(),
      fetchStarredEntryIds(),
      fetchRecentlyReadEntryIds(),
      fetchUpdatedEntryIds(lastEntrySyncTime || undefined),
    ]);

    const unreadSet = new Set(unreadIds);
    const starredSet = new Set(starredIds);

    // Determine status changes for existing entries
    const toStar: number[] = [];
    const toUnstar: number[] = [];
    const toMarkRead: number[] = [];
    const toMarkUnread: number[] = [];

    for (const [id, status] of existingEntryStatuses) {
      const shouldStar = starredSet.has(id);
      if (shouldStar && !status.starred) toStar.push(id);
      if (!shouldStar && status.starred) toUnstar.push(id);

      const shouldUnread = unreadSet.has(id);
      if (shouldUnread && status.read) toMarkUnread.push(id);
      if (!shouldUnread && !status.read) toMarkRead.push(id);
    }

    logger.info(`Starred changes: ${toStar.length} newly starred, ${toUnstar.length} unstarred`);

    // Combine all IDs we need to consider
    const idsToConsider = new Set<number>([...unreadSet, ...recentlyReadIds, ...starredSet]);

    // Split between new entries to fetch and updated entries to re-fetch
    const newEntriesToFetch = Array.from(idsToConsider).filter(
      (id) => !allExistingEntryIds.has(id)
    );
    const updatedEntriesToFetch = updatedIds.filter((id) => allExistingEntryIds.has(id));

    logger.info(`Found ${newEntriesToFetch.length} new entries to fetch`);
    logger.info(`Found ${updatedEntriesToFetch.length} updated entries to re-fetch`);

    // Step 4: Fetch full entry data
    const entriesToFetch = [...newEntriesToFetch, ...updatedEntriesToFetch];
    const entries = await fetchEntriesByIds(entriesToFetch);

    // Collect debug data if requested
    if (collectDebugData) {
      collectDebugData.entries.push(...entries);
    }

    // Step 5: Update existing entry states
    if (toUnstar.length > 0) {
      logger.info(`Updating ${toUnstar.length} entries to unstarred`);
      await bulkUpdateStarredStatus(toUnstar, false);
    }
    if (toStar.length > 0) {
      logger.info(`Updating ${toStar.length} entries to starred`);
      await bulkUpdateStarredStatus(toStar, true);
    }
    if (toMarkRead.length > 0) {
      logger.info(`Marking ${toMarkRead.length} entries read`);
      await bulkUpdateReadStatus(toMarkRead, true);
    }
    if (toMarkUnread.length > 0) {
      logger.info(`Marking ${toMarkUnread.length} entries unread`);
      await bulkUpdateReadStatus(toMarkUnread, false);
    }

    // Step 6: Ensure all required feeds exist before syncing entries
    const uniqueFeedIds = Array.from(new Set(entries.map((entry) => entry.feed_id)));
    const missingFeedIds = uniqueFeedIds.filter(
      (feedId) => !existingFeedIds.has(feedId) && !syncedFeedIds.has(feedId)
    );

    if (missingFeedIds.length > 0) {
      logger.info(`Fetching ${missingFeedIds.length} missing feeds before syncing entries`);

      const FEED_BATCH_SIZE = 20;
      let feedFetchCount = 0;

      for (let i = 0; i < missingFeedIds.length; i += FEED_BATCH_SIZE) {
        const batch = missingFeedIds.slice(i, i + FEED_BATCH_SIZE);
        logger.info(
          `Processing feed batch ${Math.floor(i / FEED_BATCH_SIZE) + 1} of ${Math.ceil(missingFeedIds.length / FEED_BATCH_SIZE)}`
        );

        await Promise.all(
          batch.map(async (feedId) => {
            try {
              feedFetchCount++;
              await syncSingleFeed(feedId, iconMap);
              syncedFeedIds.add(feedId);
              existingFeedIds.add(feedId);
              logger.info(`Fetched feed ${feedId} (${feedFetchCount} of ${missingFeedIds.length})`);
            } catch (error) {
              logger.warn(`Failed to fetch feed ${feedId}`, error);
            }
          })
        );
      }
    }

    // Step 7: Sync entries
    const updatedEntrySet = new Set(updatedEntriesToFetch);
    const entriesCreated = await syncFeedEntries(
      entries,
      unreadSet,
      starredSet,
      integrationRunId,
      updatedEntrySet
    );

    logger.complete('Feedbin sync completed successfully');
    return entriesCreated;
  } catch (error) {
    logger.error('Feedbin sync failed', error);
    throw error;
  }
}

/**
 * Fetches all Feedbin data from API without persisting
 *
 * @param debugData - Object to collect raw API data
 */
async function fetchFeedbinDataOnly(debugData: {
  subscriptions: unknown[];
  entries: unknown[];
  icons: unknown[];
}): Promise<void> {
  // Fetch subscriptions and icons
  const [subscriptions, icons] = await Promise.all([fetchSubscriptions(), fetchIcons()]);
  debugData.subscriptions.push(...subscriptions);
  debugData.icons.push(...icons);
  logger.info(`Fetched ${subscriptions.length} subscriptions and ${icons.length} icons`);

  // Fetch entry IDs
  const [unreadIds, starredIds, recentlyReadIds] = await Promise.all([
    fetchUnreadEntryIds(),
    fetchStarredEntryIds(),
    fetchRecentlyReadEntryIds(),
  ]);

  // Combine IDs and fetch entries
  const idsToFetch = [...new Set([...unreadIds, ...recentlyReadIds, ...starredIds])];
  logger.info(`Fetching ${idsToFetch.length} entries`);
  const entries = await fetchEntriesByIds(idsToFetch);
  debugData.entries.push(...entries);
  logger.info(`Fetched ${entries.length} entries`);
}

/**
 * Orchestrates the Feedbin data synchronization process
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 */
async function syncFeedbinData(debug = false): Promise<void> {
  const debugContext = createDebugContext('feedbin', debug, {
    subscriptions: [] as unknown[],
    entries: [] as unknown[],
    icons: [] as unknown[],
  });
  try {
    if (debug) {
      // Debug mode: fetch data and output to .temp/ only, skip database writes
      logger.start('Starting Feedbin data fetch (debug mode - no database writes)');
      if (debugContext.data) {
        await fetchFeedbinDataOnly(debugContext.data);
      }
      logger.complete('Feedbin data fetch completed (debug mode)');
    } else {
      // Normal mode: full sync with database writes
      logger.start('Starting Feedbin data synchronization');
      await runIntegration('feedbin', (runId) => syncFeedbin(runId, debugContext.data));
      logger.complete('Feedbin data synchronization completed successfully');
    }
  } catch (error) {
    logger.error('Error syncing Feedbin data', error);
    throw error;
  } finally {
    await debugContext.flush().catch((flushError) => {
      logger.error('Failed to write debug output for Feedbin', flushError);
    });
  }
}

export { syncFeedbinData as syncFeedbin };
