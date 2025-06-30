import { eq } from 'drizzle-orm';
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
} from './client';
import { createCleanFeedEntryEmbeddingText } from './embedding';
import type { FeedbinEntry, FeedbinIcon, FeedbinSubscription } from './types';

const logger = createIntegrationLogger('feedbin', 'sync');

/**
 * Batch size for processing embeddings
 */
const EMBEDDING_BATCH_SIZE = 20;

/**
 * Cache of synced feed IDs to avoid repeated fetches
 */
const syncedFeedIds = new Set<number>();

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
					contentUpdatedAt: new Date(),
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
						contentUpdatedAt: new Date(),
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
	integrationRunId: number
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
					// Determine read/starred status
					const isRead = !unreadIds.has(entry.id);
					const isStarred = starredIds.has(entry.id);

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

		await Promise.all(
			batch.map(async (entry) => {
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

					// Generate embedding
					const embedding = await createEmbedding(embeddingText);

					// Update entry with embedding
					await db
						.update(feedEntries)
						.set({ textEmbedding: embedding })
						.where(eq(feedEntries.id, entry.id));

					embeddingCount++;
				} catch (error) {
					errorCount++;
					logger.warn(`Failed to generate embedding for entry ${entry.id}`, error);
				}
			})
		);

		// Add a small delay between batches to avoid rate limits
		if (i + EMBEDDING_BATCH_SIZE < entriesWithoutEmbeddings.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
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
		orderBy: {
			contentCreatedAt: 'desc',
		},
	});

	return result?.contentCreatedAt || null;
}

/**
 * Main sync function for Feedbin integration
 */
async function syncFeedbin(integrationRunId: number): Promise<number> {
	try {
		// Clear the synced feed cache
		syncedFeedIds.clear();

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

		// Step 2: Fetch entry IDs
		logger.start('Fetching entry IDs');
		const [unreadIds, starredIds, recentlyReadIds] = await Promise.all([
			fetchUnreadEntryIds(),
			fetchStarredEntryIds(),
			fetchRecentlyReadEntryIds(),
		]);

		// Combine all unique entry IDs
		const allEntryIds = new Set<number>([...unreadIds, ...starredIds, ...recentlyReadIds]);

		logger.info(`Found ${allEntryIds.size} unique entries to sync`);

		// Step 3: Fetch full entry data
		const entries = await fetchEntriesByIds(Array.from(allEntryIds));

		// Step 4: Sync entries WITHOUT embeddings
		const unreadSet = new Set(unreadIds);
		const starredSet = new Set(starredIds);
		const entriesCreated = await syncFeedEntries(entries, unreadSet, starredSet, integrationRunId);

		// Step 5: Update feeds for synced entries
		const uniqueFeedIds = Array.from(new Set(entries.map((entry) => entry.feed_id)));
		const feedsToUpdate = uniqueFeedIds.filter(feedId => !syncedFeedIds.has(feedId));
		
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
			
			for (let i = 0; i < feedsToUpdate.length; i += FEED_BATCH_SIZE) {
				const batch = feedsToUpdate.slice(i, i + FEED_BATCH_SIZE);
				logger.info(`Processing feed batch ${Math.floor(i / FEED_BATCH_SIZE) + 1} of ${Math.ceil(feedsToUpdate.length / FEED_BATCH_SIZE)}`);
				
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
									contentUpdatedAt: new Date(),
								})
								.where(eq(feeds.id, feedId));

							logger.info(`Updated feed "${feed.title}" (${feedUpdateCount} of ${feedsToUpdate.length})`);
						} catch (error) {
							logger.warn(`Failed to update feed ${feedId}`, error);
						}
					})
				);
			}
		}

		// Step 6: Generate embeddings for entries
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
