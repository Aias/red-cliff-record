import {
	twitterMedia as mediaTable,
	twitterTweets as tweetsTable,
	twitterUsers as usersTable,
	type TwitterMediaInsert,
	type TwitterTweetInsert,
	type TwitterUserInsert,
} from '@aias/hozo';
import { db } from '@/server/db/connections';
import { createTwitterClient } from './client';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import { processMedia, processTweet, processUser } from './helpers';
import {
	createMediaFromTweets,
	createRecordsFromTweets,
	createRecordsFromTwitterUsers,
} from './map';
import type { Tweet, TweetData, TwitterBookmarksArray } from './types';

const logger = createIntegrationLogger('twitter', 'sync');

const FILTERED_TWEET_TYPES = ['TimelineTimelineCursor', 'TweetTombstone'];

/**
 * Gets recent tweet IDs from the database for incremental sync.
 * Only fetches the most recent N tweets (by database insertion order) to cap memory usage.
 * Since bookmarks are returned newest-first, we only need recent IDs to detect overlap.
 */
async function getRecentTweetIds(limit = 200): Promise<Set<string>> {
	const recentTweets = await db.query.twitterTweets.findMany({
		columns: { id: true },
		orderBy: { recordCreatedAt: 'desc' },
		limit,
	});
	return new Set(recentTweets.map((t) => t.id));
}

/**
 * Fetches bookmarks from Twitter API with incremental sync support.
 *
 * @param knownTweetIds - Set of tweet IDs already in database; stops pagination when encountered
 * @returns Array of bookmark responses from the API
 */
async function fetchBookmarksFromApi(knownTweetIds?: Set<string>): Promise<TwitterBookmarksArray> {
	const client = createTwitterClient({ timeoutMs: 30000 });
	return client.fetchAllBookmarks({ knownTweetIds });
}

/**
 * Synchronizes Twitter bookmarks with the database
 *
 * This function:
 * 1. Fetches bookmarks from the Twitter API
 * 2. Extracts and processes tweets, including quoted tweets
 * 3. Processes users and media associated with tweets
 * 4. Stores all data in the database
 * 5. Creates records from the Twitter data
 *
 * @param integrationRunId - The ID of the current integration run
 * @param collectDebugData - Optional array to collect raw data for debugging
 * @returns The number of successfully processed tweets
 * @throws Error if processing fails
 */
async function syncTwitterBookmarks(
	integrationRunId: number,
	collectDebugData?: unknown[]
): Promise<number> {
	try {
		// Step 1: Get recent tweet IDs for incremental sync (capped at 200 for efficiency)
		const recentTweetIds = await getRecentTweetIds();
		logger.info(`Loaded ${recentTweetIds.size} recent tweet IDs for incremental sync`);

		// Step 2: Fetch bookmarks from API (stops when it hits known tweets)
		const bookmarkResponses = await fetchBookmarksFromApi(recentTweetIds);
		if (bookmarkResponses.length === 0) {
			logger.info('No new Twitter bookmarks found');
			return 0;
		}

		// Collect debug data if requested
		if (collectDebugData) {
			collectDebugData.push(...bookmarkResponses);
		}

		// Step 2: Extract tweets from bookmarks
		const tweets = extractTweetsFromBookmarks(bookmarkResponses);
		logger.info(`Extracted ${tweets.length} tweets from bookmarks`);

		// Step 3: Process tweets, users, and media
		const { processedTweets, processedQuoteTweets, processedUsers, processedMedia } =
			processTweetData(tweets, integrationRunId);

		// Step 4: Store data in the database
		const updatedCount = await storeTweetData(
			processedTweets,
			processedQuoteTweets,
			processedUsers,
			processedMedia
		);

		// Step 5: Create records from Twitter data
		await createRelatedRecords();

		return updatedCount;
	} catch (error) {
		logger.error('Error syncing Twitter bookmarks', error);
		throw new Error(
			`Failed to sync Twitter bookmarks: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Extracts tweets from bookmark responses
 *
 * @param bookmarkResponses - Array of Twitter bookmark responses
 * @returns Array of tweet data
 */
function extractTweetsFromBookmarks(bookmarkResponses: TwitterBookmarksArray): TweetData[] {
	const tweets: TweetData[] = [];

	// Extract raw tweets from the bookmark responses
	const rawTweets = bookmarkResponses
		.flatMap((group) =>
			group.response.data.bookmark_timeline_v2.timeline.instructions.flatMap((i) => i.entries)
		)
		.map((entry) => entry.content)
		.filter((item) => !FILTERED_TWEET_TYPES.includes(item.__typename))
		.map((item) => {
			const result = item.itemContent?.tweet_results.result;
			return result?.__typename === 'TweetWithVisibilityResults'
				? { __typename: 'TweetWithVisibilityResults', ...result.tweet }
				: (result as Tweet);
		})
		.filter((result) => result);

	// Process each tweet, handling quoted tweets
	rawTweets.forEach((tweet) => {
		const { quoted_status_result: quotedTweet, ...mainTweet } = tweet;

		if (quotedTweet?.result) {
			const quotedResult = quotedTweet.result;

			// Skip filtered tweet types
			if (FILTERED_TWEET_TYPES.includes(quotedResult.__typename)) return;

			if (quotedResult.__typename === 'TweetWithVisibilityResults') {
				// Add the quoted tweet first
				tweets.push({ ...quotedResult.tweet, isQuoted: true });
				// Then add the main tweet with a reference to the quoted tweet
				tweets.push({ ...mainTweet, quotedTweetId: quotedResult.tweet.rest_id });
			} else {
				// Add the quoted tweet first
				tweets.push({ ...quotedResult, isQuoted: true });
				// Then add the main tweet with a reference to the quoted tweet
				tweets.push({ ...mainTweet, quotedTweetId: quotedResult.rest_id });
			}
		} else {
			// Add the main tweet without any quoted tweet reference
			tweets.push(mainTweet);
		}
	});

	return tweets;
}

/**
 * Processes tweet data into database-ready formats
 *
 * @param tweets - Array of tweet data
 * @param integrationRunId - The ID of the current integration run
 * @returns Object containing processed tweets, users, and media
 */
function processTweetData(tweets: TweetData[], integrationRunId: number) {
	// De-dupe aggressively to avoid redundant DB work and noisy logs.
	const processedUsersById = new Map<string, TwitterUserInsert>();
	const processedMediaById = new Map<string, TwitterMediaInsert>();
	const processedTweetsById = new Map<string, TwitterTweetInsert>();
	const processedQuoteTweetsById = new Map<string, TwitterTweetInsert>();

	tweets.forEach((t) => {
		// Process the tweet
		const tweet = processTweet(t);
		const tweetWithRun: TwitterTweetInsert = { ...tweet, integrationRunId };

		// Separate regular tweets from quote tweets
		if (tweetWithRun.quotedTweetId) {
			if (!processedQuoteTweetsById.has(tweetWithRun.id)) {
				processedQuoteTweetsById.set(tweetWithRun.id, tweetWithRun);
			}
		} else {
			if (!processedTweetsById.has(tweetWithRun.id)) {
				processedTweetsById.set(tweetWithRun.id, tweetWithRun);
			}
		}

		// Process the user
		const user = processUser(t.core.user_results.result);
		if (!processedUsersById.has(user.id)) {
			processedUsersById.set(user.id, { ...user, integrationRunId });
		}

		// Process any media attached to the tweet
		t.legacy.entities?.media?.forEach((m) => {
			const mediaData = processMedia(m, t);
			if (!processedMediaById.has(mediaData.id)) {
				processedMediaById.set(mediaData.id, { ...mediaData });
			}
		});
	});

	return {
		processedTweets: [...processedTweetsById.values()],
		processedQuoteTweets: [...processedQuoteTweetsById.values()],
		processedUsers: [...processedUsersById.values()],
		processedMedia: [...processedMediaById.values()],
	};
}

/**
 * Stores tweet data in the database
 *
 * @param processedTweets - Regular tweets to store
 * @param processedQuoteTweets - Quote tweets to store
 * @param processedUsers - Users to store
 * @param processedMedia - Media to store
 * @returns The total number of tweets stored
 */
async function storeTweetData(
	processedTweets: TwitterTweetInsert[],
	processedQuoteTweets: TwitterTweetInsert[],
	processedUsers: TwitterUserInsert[],
	processedMedia: TwitterMediaInsert[]
): Promise<number> {
	return db.transaction(
		async (tx) => {
			const CHUNK_SIZE = 1000;

			const getExistingTwitterUserIds = async (ids: string[]): Promise<Set<string>> => {
				const existing = new Set<string>();
				for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
					const chunk = ids.slice(i, i + CHUNK_SIZE);
					if (chunk.length === 0) continue;

					const rows = await tx.query.twitterUsers.findMany({
						where: {
							id: {
								in: chunk,
							},
						},
						columns: {
							id: true,
						},
					});

					for (const row of rows) existing.add(row.id);
				}
				return existing;
			};

			const getExistingTweetIds = async (ids: string[]): Promise<Set<string>> => {
				const existing = new Set<string>();
				for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
					const chunk = ids.slice(i, i + CHUNK_SIZE);
					if (chunk.length === 0) continue;

					const rows = await tx.query.twitterTweets.findMany({
						where: {
							id: {
								in: chunk,
							},
						},
						columns: {
							id: true,
						},
					});

					for (const row of rows) existing.add(row.id);
				}
				return existing;
			};

			const getExistingMediaIds = async (ids: string[]): Promise<Set<string>> => {
				const existing = new Set<string>();
				for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
					const chunk = ids.slice(i, i + CHUNK_SIZE);
					if (chunk.length === 0) continue;

					const rows = await tx.query.twitterMedia.findMany({
						where: {
							id: {
								in: chunk,
							},
						},
						columns: {
							id: true,
						},
					});

					for (const row of rows) existing.add(row.id);
				}
				return existing;
			};

			const formatProgress = (index: number, total: number): string => {
				return `[${index}/${total}]`;
			};

			// 1. Insert Users
			const existingUserIds = await getExistingTwitterUserIds(processedUsers.map((u) => u.id));
			const newUsers = processedUsers.length - existingUserIds.size;
			logger.info(
				`Users: total=${processedUsers.length} new=${newUsers} existing=${existingUserIds.size}`
			);

			let userIndex = 0;
			for (const user of processedUsers) {
				userIndex++;
				const action = existingUserIds.has(user.id) ? 'update' : 'insert';
				logger.info(
					`User ${formatProgress(userIndex, processedUsers.length)} ${action} @${user.username} (${user.id})`
				);

				await tx
					.insert(usersTable)
					.values(user)
					.onConflictDoUpdate({
						target: [usersTable.id],
						set: {
							...user,
							recordUpdatedAt: new Date(),
						},
					});
			}

			// 2. Insert Regular Tweets
			const existingTweetIds = await getExistingTweetIds(processedTweets.map((t) => t.id));
			const newTweets = processedTweets.length - existingTweetIds.size;
			logger.info(
				`Tweets: total=${processedTweets.length} new=${newTweets} existing=${existingTweetIds.size}`
			);

			let tweetIndex = 0;
			for (const tweet of processedTweets) {
				tweetIndex++;
				const action = existingTweetIds.has(tweet.id) ? 'update' : 'insert';
				logger.info(
					`Tweet ${formatProgress(tweetIndex, processedTweets.length)} ${action} (${tweet.id})`
				);

				await tx
					.insert(tweetsTable)
					.values(tweet)
					.onConflictDoUpdate({
						target: tweetsTable.id,
						set: { ...tweet, recordUpdatedAt: new Date() },
					});
			}

			// 3. Insert Quoted Tweets
			const existingQuoteTweetIds = await getExistingTweetIds(
				processedQuoteTweets.map((t) => t.id)
			);
			const newQuoteTweets = processedQuoteTweets.length - existingQuoteTweetIds.size;
			logger.info(
				`Quote tweets: total=${processedQuoteTweets.length} new=${newQuoteTweets} existing=${existingQuoteTweetIds.size}`
			);

			let quoteTweetIndex = 0;
			for (const tweet of processedQuoteTweets) {
				quoteTweetIndex++;
				const action = existingQuoteTweetIds.has(tweet.id) ? 'update' : 'insert';
				logger.info(
					`Quote tweet ${formatProgress(quoteTweetIndex, processedQuoteTweets.length)} ${action} (${tweet.id} -> ${tweet.quotedTweetId})`
				);

				await tx
					.insert(tweetsTable)
					.values(tweet)
					.onConflictDoUpdate({
						target: tweetsTable.id,
						set: { ...tweet, recordUpdatedAt: new Date() },
					});
			}

			// 4. Insert Media
			const existingMediaIds = await getExistingMediaIds(processedMedia.map((m) => m.id));
			const newMediaItems = processedMedia.length - existingMediaIds.size;
			logger.info(
				`Media: total=${processedMedia.length} new=${newMediaItems} existing=${existingMediaIds.size}`
			);

			let mediaInsertIndex = 0;
			for (const mediaItem of processedMedia) {
				if (existingMediaIds.has(mediaItem.id)) {
					continue;
				}

				mediaInsertIndex++;
				logger.info(
					`Media ${formatProgress(mediaInsertIndex, newMediaItems)} insert (${mediaItem.id}) ${mediaItem.type} ${mediaItem.tweetUrl}`
				);
				await tx.insert(mediaTable).values(mediaItem).onConflictDoNothing();
			}

			const totalTweets = processedTweets.length + processedQuoteTweets.length;
			logger.info(
				`Already in DB: users=${existingUserIds.size} tweets=${existingTweetIds.size} quoteTweets=${existingQuoteTweetIds.size} media=${existingMediaIds.size}`
			);
			logger.complete(`Processed tweets`, totalTweets);
			return totalTweets;
		},
		{
			isolationLevel: 'read committed',
		}
	);
}

/**
 * Creates records from Twitter data
 */
async function createRelatedRecords(): Promise<void> {
	logger.info('Creating related records from Twitter data...');

	const startTime = Date.now();

	await createRecordsFromTwitterUsers();
	await createRecordsFromTweets();

	const mediaStartTime = Date.now();
	logger.info('Starting media processing (this may take a while for videos)...');
	await createMediaFromTweets();

	const mediaTime = Date.now() - mediaStartTime;
	const totalTime = Date.now() - startTime;

	logger.info(
		`Record creation complete - Total: ${totalTime}ms (Media processing: ${mediaTime}ms)`
	);
}

/**
 * Orchestrates the Twitter data synchronization process
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 */
async function syncTwitterData(debug = false): Promise<void> {
	const debugContext = createDebugContext('twitter', debug, [] as unknown[]);
	try {
		if (debug) {
			// Debug mode: fetch data and output to .temp/ only, skip database writes
			logger.start('Starting Twitter data fetch (debug mode - no database writes)');
			// Still use incremental sync in debug mode to avoid fetching all pages
			const recentTweetIds = await getRecentTweetIds();
			logger.info(`Loaded ${recentTweetIds.size} recent tweet IDs for incremental sync`);
			const bookmarkResponses = await fetchBookmarksFromApi(recentTweetIds);
			debugContext.data?.push(...bookmarkResponses);
			logger.complete(`Fetched ${bookmarkResponses.length} pages of bookmarks (debug mode)`);
		} else {
			// Normal mode: full sync with database writes
			logger.start('Starting Twitter data synchronization');
			await runIntegration('twitter', (runId) => syncTwitterBookmarks(runId, debugContext.data));
			logger.complete('Twitter data synchronization completed');
		}
	} catch (error) {
		logger.error('Error syncing Twitter data', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output for Twitter', flushError);
		});
	}
}

export { syncTwitterData };
