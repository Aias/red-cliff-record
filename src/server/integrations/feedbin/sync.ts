import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { feedEntries, feeds } from '@/server/db/schema/feeds';
import { createEmbedding } from '../../../app/lib/server/create-embedding';
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
import { createCleanFeedEntryEmbeddingText } from './embedding';
import type { FeedbinEntry, FeedbinIcon, FeedbinSubscription } from './types';

const logger = createIntegrationLogger('feedbin', 'sync');

/**
 * Batch size for processing embeddings
 */
const EMBEDDING_BATCH_SIZE = 20; // Reduced to avoid rate limits

/**
 * Cache of synced feed IDs to avoid repeated fetches
 */
const syncedFeedIds = new Set<number>();

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
	for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
		const batch = entryIds.slice(i, i + BATCH_SIZE);
		await db
			.update(feedEntries)
			.set({ read, recordUpdatedAt: now })
			.where(inArray(feedEntries.id, batch));
	}
}

/**
 * Sync a single feed from Feedbin
 */
async function syncSingleFeed(feedId: number): Promise<void> {
	try {
		const feed = await fetchFeed(feedId);

		// Extract icon URL
		let iconUrl: string | null = null;
		if (feed.site_url) {
			try {
				const icons = await fetchIcons();
				const iconMap = new Map<string, string>();
				for (const icon of icons) {
					iconMap.set(icon.host, icon.url);
				}
				const url = new URL(feed.site_url);
				iconUrl = iconMap.get(url.hostname) || null;
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
	icons: FeedbinIcon[],
	_integrationRunId: number
): Promise<void> {
	logger.start(`Syncing ${subscriptions.length} feeds`);

	// Create icon lookup map
	const iconMap = new Map<string, string>();
	for (const icon of icons) {
		iconMap.set(icon.host, icon.url);
	}

	for (const [index, subscription] of subscriptions.entries()) {
		try {
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

			logger.info(`Synced feed "${subscription.title}" (${index + 1} of ${subscriptions.length})`);
		} catch (error) {
			logger.warn(`Failed to sync feed ${subscription.feed_id}`, error);
		}
	}

	logger.complete(`Synced ${subscriptions.length} feeds`);
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

	let successCount = 0;

	// Process entries in batches
	for (let i = 0; i < entries.length; i += EMBEDDING_BATCH_SIZE) {
		const batch = entries.slice(i, i + EMBEDDING_BATCH_SIZE);

		await Promise.all(
			batch.map(async (entry, batchIndex) => {
				const globalIndex = i + batchIndex + 1;
				try {
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
									enclosureLength:
										typeof enc.enclosure_length === 'number' ? enc.enclosure_length : 0,
									itunesDuration: enc.itunes_duration || null,
									itunesImage,
								};
							}
						}
					}

					// Upsert entry (without embedding - will be done in post-process)
					try {
						await db
							.insert(feedEntries)
							.values({
								id: entry.id,
								feedId: entry.feed_id,
								url: entry.url,
								title: entry.title,
								author: entry.author,
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
									content: entry.content,
									imageUrls,
									enclosure,
									read: isRead,
									starred: isStarred,
									publishedAt: entry.published,
									recordUpdatedAt: new Date(),
								},
							});
					} catch (error: unknown) {
						// Check if it's a foreign key constraint error
						if (
							error instanceof Error &&
							error.message.includes('feed_entries_feed_id_feeds_id_fk')
						) {
							// Feed doesn't exist, fetch and sync it
							if (!syncedFeedIds.has(entry.feed_id)) {
								logger.info(`Fetching missing feed ${entry.feed_id} for entry ${entry.id}`);
								await syncSingleFeed(entry.feed_id);
								syncedFeedIds.add(entry.feed_id);

								// Retry the insert
								await db
									.insert(feedEntries)
									.values({
										id: entry.id,
										feedId: entry.feed_id,
										url: entry.url,
										title: entry.title,
										author: entry.author,
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
											content: entry.content,
											imageUrls,
											enclosure,
											read: isRead,
											starred: isStarred,
											publishedAt: entry.published,
											recordUpdatedAt: new Date(),
										},
									});
							} else {
								throw error;
							}
						} else {
							throw error;
						}
					}

					successCount++;
					logger.info(
						`Synced entry "${entry.title || 'Untitled'}" (${entry.id}) - ${globalIndex} of ${entries.length}`
					);
				} catch (error) {
					logger.warn(
						`Failed to sync entry ${entry.id} (${globalIndex} of ${entries.length})`,
						error
					);
				}
			})
		);
	}

	logger.complete(`Synced ${successCount} of ${entries.length} entries`);
	return successCount;
}

/**
 * Bulk update starred status for multiple entries
 */
async function bulkUpdateStarredStatus(entryIds: number[], starred: boolean): Promise<void> {
	if (entryIds.length === 0) return;

	const BATCH_SIZE = 1000; // Process in batches to avoid query size limits
	for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
		const batch = entryIds.slice(i, i + BATCH_SIZE);
		await db.update(feedEntries).set({ starred }).where(inArray(feedEntries.id, batch));
	}
}

/**
 * Generate embeddings for feed entries that don't have them
 */
async function generateFeedEntryEmbeddings(): Promise<void> {
	logger.start('Generating embeddings for feed entries');

	// Get entries without embeddings
	const entriesWithoutEmbeddings = await db.query.feedEntries.findMany({
		columns: {
			id: true,
			title: true,
			author: true,
			content: true,
			url: true,
			publishedAt: true,
		},
		where: {
			textEmbedding: {
				isNull: true,
			},
		},
	});

	if (entriesWithoutEmbeddings.length === 0) {
		logger.info('All feed entries already have embeddings');
		return;
	}

	logger.info(`Found ${entriesWithoutEmbeddings.length} entries without embeddings`);

	let embeddingCount = 0;
	let errorCount = 0;

	// Process in batches
	for (let i = 0; i < entriesWithoutEmbeddings.length; i += EMBEDDING_BATCH_SIZE) {
		const batch = entriesWithoutEmbeddings.slice(i, i + EMBEDDING_BATCH_SIZE);

		logger.info(
			`Processing batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} of ${Math.ceil(entriesWithoutEmbeddings.length / EMBEDDING_BATCH_SIZE)}`
		);

		// Process entries sequentially within batch to better handle rate limits
		for (const entry of batch) {
			try {
				// Create embedding text
				const embeddingText = createCleanFeedEntryEmbeddingText({
					title: entry.title,
					author: entry.author,
					content: entry.content,
					summary: entry.content, // Use content as summary if not available
					url: entry.url,
					published: entry.publishedAt || new Date(),
				} as FeedbinEntry);

				// Generate embedding with retry logic
				const embedding = await createEmbedding(embeddingText);

				// Update entry with embedding
				await db
					.update(feedEntries)
					.set({ textEmbedding: embedding })
					.where(eq(feedEntries.id, entry.id));

				embeddingCount++;

				// Add a small delay between individual embeddings to avoid hitting rate limits
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				errorCount++;
				logger.warn(`Failed to generate embedding for entry ${entry.id}`, error);

				// If we hit a rate limit despite retries, wait longer before continuing
				if (error instanceof Error && error.message.includes('rate limit')) {
					logger.info('Hit rate limit despite retries, waiting 30 seconds before continuing...');
					await new Promise((resolve) => setTimeout(resolve, 30000));
				}
			}
		}

		// Add a delay between batches
		if (i + EMBEDDING_BATCH_SIZE < entriesWithoutEmbeddings.length) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	logger.complete(`Generated ${embeddingCount} embeddings (${errorCount} errors)`);
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
async function syncFeedbin(integrationRunId: number): Promise<number> {
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

		if (newSubscriptions.length > 0) {
			logger.info(`Syncing ${newSubscriptions.length} new subscriptions`);
			await syncFeeds(newSubscriptions, icons, integrationRunId);
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

		// Step 6: Sync entries WITHOUT embeddings
		const updatedEntrySet = new Set(updatedEntriesToFetch);
		const entriesCreated = await syncFeedEntries(
			entries,
			unreadSet,
			starredSet,
			integrationRunId,
			updatedEntrySet
		);

		// Step 7: Update feeds for synced entries
		const uniqueFeedIds = Array.from(new Set(entries.map((entry) => entry.feed_id)));
		const feedsToUpdate = uniqueFeedIds.filter(
			(feedId) => !existingFeedIds.has(feedId) && !syncedFeedIds.has(feedId)
		);

		if (feedsToUpdate.length > 0) {
			logger.info(`Updating ${feedsToUpdate.length} feeds from synced entries`);

			// Create icon lookup map
			const iconMap = new Map<string, string>();
			for (const icon of icons) {
				iconMap.set(icon.host, icon.url);
			}

			// Process feeds in batches
			const FEED_BATCH_SIZE = 20;
			let feedUpdateCount = 0;
			const now = new Date();

			for (let i = 0; i < feedsToUpdate.length; i += FEED_BATCH_SIZE) {
				const batch = feedsToUpdate.slice(i, i + FEED_BATCH_SIZE);
				logger.info(
					`Processing feed batch ${Math.floor(i / FEED_BATCH_SIZE) + 1} of ${Math.ceil(feedsToUpdate.length / FEED_BATCH_SIZE)}`
				);

				await Promise.all(
					batch.map(async (feedId) => {
						try {
							feedUpdateCount++;
							const feed = await fetchFeed(feedId);

							// Extract icon URL
							let iconUrl: string | null = null;
							if (feed.site_url) {
								try {
									const url = new URL(feed.site_url);
									iconUrl = iconMap.get(url.hostname) || null;
								} catch {
									// Ignore URL parsing errors
								}
							}

							// Update feed with latest data
							await db
								.update(feeds)
								.set({
									name: feed.title,
									feedUrl: feed.feed_url,
									siteUrl: feed.site_url,
									iconUrl,
									recordUpdatedAt: now,
								})
								.where(eq(feeds.id, feedId));

							logger.info(
								`Updated feed "${feed.title}" (${feedUpdateCount} of ${feedsToUpdate.length})`
							);
						} catch (error) {
							logger.warn(`Failed to update feed ${feedId}`, error);
						}
					})
				);
			}
		}

		// Step 8: Generate embeddings for entries
		await generateFeedEntryEmbeddings();

		logger.complete('Feedbin sync completed successfully');
		return entriesCreated;
	} catch (error) {
		logger.error('Feedbin sync failed', error);
		throw error;
	}
}

// Main function for direct execution
const main = async () => {
	try {
		logger.start('=== STARTING FEEDBIN SYNC ===');
		await runIntegration('feedbin', syncFeedbin);
		logger.complete('=== FEEDBIN SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Feedbin sync main function', error);
		logger.error('=== FEEDBIN SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncFeedbin };
