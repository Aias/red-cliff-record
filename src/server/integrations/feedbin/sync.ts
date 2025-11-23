import { feedEntries, feeds } from '@rcr/data/feeds';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { createEmbedding } from '../../../app/lib/server/create-embedding';
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
import { createCleanFeedEntryEmbeddingText } from './embedding';
import type { FeedbinEntry, FeedbinIcon, FeedbinSubscription } from './types';

const logger = createIntegrationLogger('feedbin', 'sync');

/**
 * Batch size for processing embeddings
 */
const EMBEDDING_BATCH_SIZE = 30;

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

/**
 * Process a single entry with timeout
 */
async function processSingleEntry(
	entry: FeedbinEntry,
	unreadIds: Set<number>,
	starredIds: Set<number>,
	integrationRunId: number,
	updatedEntryIds: Set<number> | undefined,
	timeoutMs: number = 5000,
	iconMap?: Map<string, string>
): Promise<boolean> {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => {
			logger.error(`Timeout processing entry ${entry.id} after ${timeoutMs}ms`);
			resolve(false);
		}, timeoutMs);

		(async () => {
			try {
				// Determine a usable URL for the entry
				const effectiveUrl = entry.url ?? entry.extracted_content_url ?? null;
				if (!effectiveUrl) {
					// Skip entries without any URL; database requires non-null URL
					logger.warn(
						`Skipping entry #${entry.id}: ${entry.title} (feed ${entry.feed_id}) because it has no URL`
					);
					clearTimeout(timeout);
					return resolve(true);
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
								textEmbedding: null, // Updated entries should re-generate embeddings
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
							await syncSingleFeed(entry.feed_id, iconMap);
							syncedFeedIds.add(entry.feed_id);

							// Retry the insert
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
										textEmbedding: null,
									},
								});
						} else {
							throw error;
						}
					} else {
						throw error;
					}
				}

				clearTimeout(timeout);
				resolve(true);
			} catch (error) {
				clearTimeout(timeout);
				logger.warn(`Failed to sync entry ${entry.id}`, error);
				resolve(false);
			}
		})();
	});
}

/**
 * Sync feed entries from Feedbin
 */
async function syncFeedEntries(
	entries: FeedbinEntry[],
	unreadIds: Set<number>,
	starredIds: Set<number>,
	integrationRunId: number,
	updatedEntryIds?: Set<number>,
	iconMap?: Map<string, string>
): Promise<number> {
	logger.start(`Syncing ${entries.length} entries`);

	const successfulEntryIds = new Set<number>();
	const failedEntryMap = new Map<number, FeedbinEntry>();
	const BATCH_TIMEOUT_MS = 30000; // 30 seconds per batch
	const ENTRY_TIMEOUT_MS = 5000; // 5 seconds per entry
	const MAX_RETRY_DURATION_MS = 60000; // Retry failed entries for up to 60 seconds total
	const RETRY_INITIAL_DELAY_MS = 1000; // 1 second initial backoff

	// Process entries in batches
	for (let i = 0; i < entries.length; i += EMBEDDING_BATCH_SIZE) {
		const batch = entries.slice(i, i + EMBEDDING_BATCH_SIZE);
		const batchStartTime = Date.now();

		logger.info(
			`Processing batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} of ${Math.ceil(entries.length / EMBEDDING_BATCH_SIZE)} (${batch.length} entries)`
		);

		// Set up batch timeout
		const batchPromise = Promise.all(
			batch.map(async (entry, batchIndex) => {
				const globalIndex = i + batchIndex + 1;
				const success = await processSingleEntry(
					entry,
					unreadIds,
					starredIds,
					integrationRunId,
					updatedEntryIds,
					ENTRY_TIMEOUT_MS,
					iconMap
				);
				return { entry, success, globalIndex };
			})
		);

		let raceResults: Array<{ entry: FeedbinEntry; success: boolean; globalIndex: number }> | null =
			null;

		try {
			raceResults = (await Promise.race([
				batchPromise,
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error(`Batch timeout after ${BATCH_TIMEOUT_MS}ms`)),
						BATCH_TIMEOUT_MS
					)
				),
			])) as Array<{ entry: FeedbinEntry; success: boolean; globalIndex: number }>;
			const batchDuration = Date.now() - batchStartTime;
			logger.info(`Batch completed in ${batchDuration}ms`);
		} catch (error) {
			logger.error(`Batch processing failed or timed out`, error);
			// Continue with next batch even if this one fails
			for (const entry of batch) {
				failedEntryMap.set(entry.id, entry);
			}
		}

		if (raceResults) {
			for (const { entry, success, globalIndex } of raceResults) {
				if (success) {
					if (!successfulEntryIds.has(entry.id)) {
						successfulEntryIds.add(entry.id);
					}
					failedEntryMap.delete(entry.id);
					logger.info(
						`Synced entry "${entry.title || 'Untitled'}" (${entry.id}) - ${globalIndex} of ${entries.length}`
					);
				} else {
					failedEntryMap.set(entry.id, entry);
					logger.warn(`Failed to sync entry ${entry.id} (${globalIndex} of ${entries.length})`);
				}
			}
		}

		// Add delay between batches to prevent overwhelming the system
		if (i + EMBEDDING_BATCH_SIZE < entries.length) {
			logger.info('Waiting 2 seconds before next batch...');
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	const retryFailedEntries = async () => {
		if (failedEntryMap.size === 0) {
			return;
		}

		logger.info(`Retrying ${failedEntryMap.size} failed entries with exponential backoff`);

		let attempt = 1;
		let delayMs = RETRY_INITIAL_DELAY_MS;
		const retryStart = Date.now();
		let pendingEntries = Array.from(failedEntryMap.values());

		while (pendingEntries.length > 0 && Date.now() - retryStart < MAX_RETRY_DURATION_MS) {
			logger.info(`Retry attempt ${attempt} for ${pendingEntries.length} entries`);

			const attemptResults = await Promise.all(
				pendingEntries.map(async (entry) => {
					const success = await processSingleEntry(
						entry,
						unreadIds,
						starredIds,
						integrationRunId,
						updatedEntryIds,
						ENTRY_TIMEOUT_MS,
						iconMap
					);
					return { entry, success };
				})
			);

			pendingEntries = [];

			for (const { entry, success } of attemptResults) {
				if (success) {
					if (!successfulEntryIds.has(entry.id)) {
						successfulEntryIds.add(entry.id);
					}
					failedEntryMap.delete(entry.id);
					logger.info(
						`Retry attempt ${attempt} succeeded for entry "${entry.title || 'Untitled'}" (${entry.id})`
					);
				} else {
					failedEntryMap.set(entry.id, entry);
					pendingEntries.push(entry);
					logger.warn(`Retry attempt ${attempt} failed for entry ${entry.id}`);
				}
			}

			if (pendingEntries.length === 0) {
				break;
			}

			const elapsed = Date.now() - retryStart;
			if (elapsed >= MAX_RETRY_DURATION_MS) {
				break;
			}

			const waitMs = Math.min(delayMs, MAX_RETRY_DURATION_MS - elapsed);
			logger.info(`Waiting ${waitMs}ms before retrying ${pendingEntries.length} entries`);
			await new Promise((resolve) => setTimeout(resolve, waitMs));
			delayMs = Math.min(delayMs * 2, MAX_RETRY_DURATION_MS);
			attempt++;
		}

		if (failedEntryMap.size > 0) {
			logger.error(
				`Failed to sync ${failedEntryMap.size} entries after retries totaling ${Math.min(
					Date.now() - retryStart,
					MAX_RETRY_DURATION_MS
				)}ms`
			);
		} else {
			logger.info('All previously failed entries synced successfully');
		}
	};

	await retryFailedEntries();

	const successCount = successfulEntryIds.size;

	if (failedEntryMap.size > 0) {
		logger.warn(`Failed to sync ${failedEntryMap.size} entries after retry attempts`);
	}

	logger.complete(`Synced ${successCount} of ${entries.length} entries`);
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
			summary: true,
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
	const BATCH_TIMEOUT_MS = 60000; // 60 seconds per batch (longer for embeddings)
	const ENTRY_TIMEOUT_MS = 15000; // 15 seconds per entry

	// Process in batches
	for (let i = 0; i < entriesWithoutEmbeddings.length; i += EMBEDDING_BATCH_SIZE) {
		const batch = entriesWithoutEmbeddings.slice(i, i + EMBEDDING_BATCH_SIZE);
		const batchStartTime = Date.now();

		logger.info(
			`Processing batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} of ${Math.ceil(entriesWithoutEmbeddings.length / EMBEDDING_BATCH_SIZE)} (${batch.length} entries)`
		);

		// Set up batch timeout
		const batchPromise = Promise.all(
			batch.map(async (entry) => {
				return new Promise<{ success: boolean }>((resolve) => {
					const timeout = setTimeout(() => {
						logger.error(
							`Timeout generating embedding for entry ${entry.id} after ${ENTRY_TIMEOUT_MS}ms`
						);
						resolve({ success: false });
					}, ENTRY_TIMEOUT_MS);

					(async () => {
						try {
							// Create embedding text
							const embeddingText = createCleanFeedEntryEmbeddingText({
								title: entry.title,
								author: entry.author,
								summary: entry.summary,
								content: entry.content,
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

							clearTimeout(timeout);
							resolve({ success: true });
						} catch (error) {
							clearTimeout(timeout);
							logger.warn(`Failed to generate embedding for entry ${entry.id}`, error);

							// If we hit a rate limit despite retries, wait longer before continuing
							if (error instanceof Error && error.message.includes('rate limit')) {
								logger.info(
									'Hit rate limit despite retries, waiting 10 seconds before continuing...'
								);
								await new Promise((resolve) => setTimeout(resolve, 10000));
							}
							resolve({ success: false });
						}
					})();
				});
			})
		);

		try {
			const results = await Promise.race([
				batchPromise,
				new Promise<{ success: boolean }[]>((_, reject) =>
					setTimeout(
						() => reject(new Error(`Batch timeout after ${BATCH_TIMEOUT_MS}ms`)),
						BATCH_TIMEOUT_MS
					)
				),
			]);

			// Count successes and failures
			for (const result of results) {
				if (result.success) {
					embeddingCount++;
				} else {
					errorCount++;
				}
			}

			const batchDuration = Date.now() - batchStartTime;
			logger.info(`Batch completed in ${batchDuration}ms`);
		} catch (error) {
			logger.error(`Batch processing failed or timed out`, error);
			// Continue with next batch even if this one fails
			errorCount += batch.length;
		}

		// Add a delay between batches
		if (i + EMBEDDING_BATCH_SIZE < entriesWithoutEmbeddings.length) {
			logger.info('Waiting 2 seconds before next batch...');
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

		// Step 6: Sync entries WITHOUT embeddings
		const updatedEntrySet = new Set(updatedEntriesToFetch);
		const entriesCreated = await syncFeedEntries(
			entries,
			unreadSet,
			starredSet,
			integrationRunId,
			updatedEntrySet,
			iconMap
		);

		// Step 7: Update feeds for synced entries
		const uniqueFeedIds = Array.from(new Set(entries.map((entry) => entry.feed_id)));
		const feedsToUpdate = uniqueFeedIds.filter(
			(feedId) => !existingFeedIds.has(feedId) && !syncedFeedIds.has(feedId)
		);

		if (feedsToUpdate.length > 0) {
			logger.info(`Updating ${feedsToUpdate.length} feeds from synced entries`);

			// Create icon lookup map
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

/**
 * Orchestrates the Feedbin data synchronization process
 *
 * @param debug - If true, writes raw API data to a timestamped JSON file
 */
async function syncFeedbinData(debug = false): Promise<void> {
	const debugContext = createDebugContext('feedbin', debug, {
		subscriptions: [] as unknown[],
		entries: [] as unknown[],
		icons: [] as unknown[],
	});
	try {
		logger.start('Starting Feedbin data synchronization');

		await runIntegration('feedbin', (runId) => syncFeedbin(runId, debugContext.data));

		logger.complete('Feedbin data synchronization completed successfully');
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
