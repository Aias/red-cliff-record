import {
  twitterMedia as mediaTable,
  twitterTweets as tweetsTable,
  twitterUsers as usersTable,
  type TwitterMediaInsert,
  type TwitterTweetInsert,
  type TwitterUserInsert,
} from '@hozo';
import { db } from '@/server/db/connections/postgres';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import { createTwitterClient } from './client';
import { processMedia, processTweet, processUser } from './helpers';
import {
  createMediaFromTweets,
  createRecordsFromTweets,
  createRecordsFromTwitterUsers,
} from './map';
import type { Tweet, TweetData, TwitterBookmarksArray } from './types';
import { isTweet, isTweetWithVisibilityResults, TimelineItemSchema } from './types';

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
 * Checks which tweet IDs from a list exist in the database.
 */
async function getTweetIdsInDb(tweetIds: string[]): Promise<Set<string>> {
  if (tweetIds.length === 0) return new Set();

  const rows = await db.query.twitterTweets.findMany({
    where: { id: { in: tweetIds } },
    columns: { id: true },
  });
  return new Set(rows.map((r) => r.id));
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
    const allExtractedTweets = extractTweetsFromBookmarks(bookmarkResponses);
    logger.info(`Extracted ${allExtractedTweets.length} tweets from bookmarks`);

    // Step 3: Filter to only new tweets (not already in DB)
    const extractedTweetIds = allExtractedTweets.map((t) => t.rest_id);
    const existingTweetIds = await getTweetIdsInDb(extractedTweetIds);
    const newTweets = allExtractedTweets.filter((t) => !existingTweetIds.has(t.rest_id));
    logger.info(
      `Filtered to ${newTweets.length} new tweets (${existingTweetIds.size} already in DB)`
    );

    if (newTweets.length === 0) {
      logger.info('No new tweets to process');
      return 0;
    }

    // Step 4: Fetch missing parent tweets for replies (only for new tweets)
    const { parentTweets, existingParentIds } = await fetchMissingParentTweets(
      newTweets,
      existingTweetIds // Pass existing IDs so we don't re-fetch parents already in DB
    );
    const allTweets = [...parentTweets, ...newTweets]; // Parents first so they're inserted before replies
    logger.info(
      `Total tweets to process: ${allTweets.length} (${parentTweets.length} parent tweets)`
    );

    // Step 4: Process tweets, users, and media
    const { processedTweets, processedUsers, processedMedia } = processTweetData(
      allTweets,
      integrationRunId,
      existingParentIds
    );

    // Step 5: Store data in the database
    const updatedCount = await storeTweetData(processedTweets, processedUsers, processedMedia);

    // Step 6: Create records from Twitter data
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

      // If quoted tweet is unavailable (tombstone/deleted), still add the main tweet
      if (FILTERED_TWEET_TYPES.includes(quotedResult.__typename)) {
        tweets.push(mainTweet);
        return;
      }

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
 * Fetches parent tweets for replies that aren't in the current batch or already in DB.
 * If a parent can't be fetched (suspended/deleted) but exists in DB, we'll find out via a targeted query.
 *
 * @param tweets - Array of tweet data to check for replies
 * @param knownExistingIds - Set of tweet IDs known to exist in DB (skip fetching these)
 * @returns Object with parent tweets and set of parent IDs that exist in DB
 */
async function fetchMissingParentTweets(
  tweets: TweetData[],
  knownExistingIds: Set<string>
): Promise<{
  parentTweets: TweetData[];
  existingParentIds: Set<string>;
}> {
  // Collect reply parent IDs that need fetching
  const batchTweetIds = new Set(tweets.map((t) => t.rest_id));
  const parentIdsToFetch: string[] = [];

  for (const tweet of tweets) {
    const replyToId = tweet.legacy.in_reply_to_status_id_str;
    if (replyToId) {
      // Log thread info for visibility
      const conversationId = tweet.legacy.conversation_id_str;
      if (conversationId && conversationId !== tweet.rest_id) {
        logger.info(`Tweet ${tweet.rest_id} is part of thread ${conversationId}`);
      }
      logger.info(`Tweet ${tweet.rest_id} replies to ${replyToId}`);

      // Skip if already in current batch or known to exist in DB
      if (!batchTweetIds.has(replyToId) && !knownExistingIds.has(replyToId)) {
        // Avoid duplicates in the fetch list
        if (!parentIdsToFetch.includes(replyToId)) {
          parentIdsToFetch.push(replyToId);
        }
      }
    }
  }

  if (parentIdsToFetch.length === 0) {
    logger.info('No parent tweets to fetch');
    return { parentTweets: [], existingParentIds: knownExistingIds };
  }

  logger.info(`Fetching ${parentIdsToFetch.length} parent tweets...`);

  const client = createTwitterClient({ timeoutMs: 30000 });
  const parentTweets: TweetData[] = [];
  const failedFetchIds: string[] = [];

  for (let i = 0; i < parentIdsToFetch.length; i++) {
    const parentId = parentIdsToFetch[i];
    if (!parentId) {
      continue;
    }
    try {
      const result = await client.fetchTweetById(parentId);

      if (result.success) {
        const parsed = TimelineItemSchema.safeParse(result.tweetResult);
        if (parsed.success) {
          const tweetResult = parsed.data;

          if (isTweetWithVisibilityResults(tweetResult)) {
            logger.info(`Fetched parent tweet ${parentId}`);
            parentTweets.push({ ...tweetResult.tweet, isQuoted: false });
          } else if (isTweet(tweetResult)) {
            logger.info(`Fetched parent tweet ${parentId}`);
            parentTweets.push({ ...tweetResult, isQuoted: false });
          } else {
            logger.warn(
              `Parent tweet ${parentId} is not a valid tweet type: ${tweetResult.__typename}`
            );
            failedFetchIds.push(parentId);
          }
        } else {
          logger.warn(`Failed to parse parent tweet ${parentId}: ${parsed.error.message}`);
          failedFetchIds.push(parentId);
        }
      } else {
        logger.warn(`Failed to fetch parent tweet ${parentId}: ${result.error}`);
        failedFetchIds.push(parentId);
      }
    } catch (error) {
      logger.error(`Error fetching parent tweet ${parentId}`, error);
      failedFetchIds.push(parentId);
    }

    // Small delay between requests for rate limiting
    await Bun.sleep(300);
    logger.info(`Parent tweet fetch progress: ${i + 1}/${parentIdsToFetch.length}`);
  }

  logger.info(`Fetched ${parentTweets.length} parent tweets, ${failedFetchIds.length} failed`);

  // For failed fetches, check if they exist in DB (might be older tweets we already have)
  let existingFromFailedFetches = new Set<string>();
  if (failedFetchIds.length > 0) {
    const rows = await db.query.twitterTweets.findMany({
      where: { id: { in: failedFetchIds } },
      columns: { id: true },
    });
    existingFromFailedFetches = new Set(rows.map((r) => r.id));
    if (existingFromFailedFetches.size > 0) {
      logger.info(
        `Found ${existingFromFailedFetches.size} parent tweets in DB from failed fetches`
      );
    }
  }

  // Combine known existing IDs with any we found from failed fetches
  const existingParentIds = new Set([...knownExistingIds, ...existingFromFailedFetches]);

  return { parentTweets, existingParentIds };
}

/**
 * Topologically sorts tweets so that dependencies (reply parents, quoted tweets) come first.
 * This ensures FK constraints are satisfied when inserting in order.
 *
 * @param tweets - Array of processed tweets
 * @returns Array sorted so parents/quoted tweets come before their dependents
 */
function topologicalSortTweets(tweets: TwitterTweetInsert[]): TwitterTweetInsert[] {
  const tweetMap = new Map<string, TwitterTweetInsert>();
  for (const t of tweets) tweetMap.set(t.id, t);

  const sorted: TwitterTweetInsert[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  function visit(tweet: TwitterTweetInsert) {
    if (visited.has(tweet.id)) return;
    if (visiting.has(tweet.id)) {
      // Cycle detected - just add it (FK will be handled by DB or cleared earlier)
      visited.add(tweet.id);
      sorted.push(tweet);
      return;
    }

    visiting.add(tweet.id);

    // Visit dependencies first (if they're in this batch)
    if (tweet.inReplyToTweetId && tweetMap.has(tweet.inReplyToTweetId)) {
      const parent = tweetMap.get(tweet.inReplyToTweetId);
      if (parent) visit(parent);
    }
    if (tweet.quotedTweetId && tweetMap.has(tweet.quotedTweetId)) {
      const quoted = tweetMap.get(tweet.quotedTweetId);
      if (quoted) visit(quoted);
    }

    visiting.delete(tweet.id);
    visited.add(tweet.id);
    sorted.push(tweet);
  }

  for (const tweet of tweets) {
    visit(tweet);
  }

  return sorted;
}

/**
 * Processes tweet data into database-ready formats
 *
 * @param tweets - Array of tweet data
 * @param integrationRunId - The ID of the current integration run
 * @param existingParentIds - Set of reply parent tweet IDs that exist in database (for FK validation)
 * @returns Object containing processed tweets, users, and media
 */
function processTweetData(
  tweets: TweetData[],
  integrationRunId: number,
  existingParentIds: Set<string>
) {
  // De-dupe aggressively to avoid redundant DB work and noisy logs.
  const processedUsersById = new Map<string, TwitterUserInsert>();
  const processedMediaById = new Map<string, TwitterMediaInsert>();
  const processedTweetsById = new Map<string, TwitterTweetInsert>();
  const processedQuoteTweetsById = new Map<string, TwitterTweetInsert>();

  // Build set of all tweet IDs that will exist after this batch:
  // - Reply parent IDs that already exist in DB
  // - All tweet IDs in the current batch
  const allValidReplyTargets = new Set(existingParentIds);
  for (const t of tweets) {
    allValidReplyTargets.add(t.rest_id);
  }

  tweets.forEach((t) => {
    // Process the user first - skip if invalid (suspended/unavailable account)
    const userResult = t.core.user_results.result;
    const user = processUser(userResult);
    if (!user) {
      const username = userResult.core?.screen_name ?? userResult.legacy.screen_name ?? 'unknown';
      const displayName = userResult.core?.name ?? userResult.legacy.name ?? 'unknown';
      logger.warn(
        `Skipping tweet ${t.rest_id}: user missing required fields (id=${userResult.rest_id}, username=${username}, name=${displayName})`
      );
      return;
    }

    // Process the tweet
    const tweet = processTweet(t);

    // Only set inReplyToTweetId if the parent tweet exists (or will exist in this batch)
    // This prevents FK constraint violations for missing parent tweets
    const validReplyToId =
      tweet.inReplyToTweetId && allValidReplyTargets.has(tweet.inReplyToTweetId)
        ? tweet.inReplyToTweetId
        : undefined;

    if (tweet.inReplyToTweetId && !validReplyToId) {
      logger.warn(
        `Tweet ${tweet.id} replies to ${tweet.inReplyToTweetId} but parent not in DB, clearing inReplyToTweetId`
      );
    }

    const tweetWithRun: TwitterTweetInsert = {
      ...tweet,
      inReplyToTweetId: validReplyToId,
      integrationRunId,
    };

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

    // Store the user
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

  // Topologically sort all tweets so dependencies are inserted first
  // (both regular and quote tweets together, since a regular tweet could reply to a quote tweet)
  const allTweetsUnsorted = [...processedTweetsById.values(), ...processedQuoteTweetsById.values()];
  const sortedTweets = topologicalSortTweets(allTweetsUnsorted);

  return {
    processedTweets: sortedTweets,
    processedUsers: [...processedUsersById.values()],
    processedMedia: [...processedMediaById.values()],
  };
}

/**
 * Stores tweet data in the database
 *
 * @param processedTweets - All tweets to store (topologically sorted so dependencies come first)
 * @param processedUsers - Users to store
 * @param processedMedia - Media to store
 * @returns The total number of tweets stored
 */
async function storeTweetData(
  processedTweets: TwitterTweetInsert[],
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

      // 2. Insert Tweets (already topologically sorted so dependencies come first)
      const existingTweetIds = await getExistingTweetIds(processedTweets.map((t) => t.id));
      const newTweetsCount = processedTweets.length - existingTweetIds.size;
      logger.info(
        `Tweets: total=${processedTweets.length} new=${newTweetsCount} existing=${existingTweetIds.size}`
      );

      let tweetIndex = 0;
      for (const tweet of processedTweets) {
        tweetIndex++;
        const action = existingTweetIds.has(tweet.id) ? 'update' : 'insert';
        const tweetType = tweet.quotedTweetId ? 'quote' : 'tweet';
        const suffix = tweet.quotedTweetId ? ` -> ${tweet.quotedTweetId}` : '';
        logger.info(
          `Tweet ${formatProgress(tweetIndex, processedTweets.length)} ${action} ${tweetType} (${tweet.id}${suffix})`
        );

        await tx
          .insert(tweetsTable)
          .values(tweet)
          .onConflictDoUpdate({
            target: tweetsTable.id,
            set: { ...tweet, recordUpdatedAt: new Date() },
          });
      }

      // 3. Insert Media
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

      logger.info(
        `Already in DB: users=${existingUserIds.size} tweets=${existingTweetIds.size} media=${existingMediaIds.size}`
      );
      logger.complete(`Processed tweets`, processedTweets.length);
      return processedTweets.length;
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
      // Debug mode: fetch and process data, output to .temp/ without database writes
      logger.start('Starting Twitter data fetch (debug mode - no database writes)');

      // Fetch bookmarks (still use incremental sync to avoid fetching all pages)
      const recentTweetIds = await getRecentTweetIds();
      logger.info(`Loaded ${recentTweetIds.size} recent tweet IDs for incremental sync`);
      const bookmarkResponses = await fetchBookmarksFromApi(recentTweetIds);
      logger.info(`Fetched ${bookmarkResponses.length} pages of bookmarks`);

      // Extract tweets - in debug mode, process ALL tweets (don't filter by "already in DB")
      const allExtractedTweets = extractTweetsFromBookmarks(bookmarkResponses);
      logger.info(`Extracted ${allExtractedTweets.length} tweets from bookmarks`);

      // Check which exist in DB (for reference) but process all in debug mode
      const extractedTweetIds = allExtractedTweets.map((t) => t.rest_id);
      const existingTweetIds = await getTweetIdsInDb(extractedTweetIds);
      logger.info(`${existingTweetIds.size} of ${allExtractedTweets.length} tweets already in DB`);

      // In debug mode, process all tweets to verify parsing/expansion
      const allTweets = allExtractedTweets;
      const existingParentIds = existingTweetIds;
      logger.info(`Processing all ${allTweets.length} tweets for debug output`);

      // Process into database-ready format (with URL expansion, etc.)
      const { processedTweets, processedUsers, processedMedia } = processTweetData(
        allTweets,
        0, // dummy integration run ID for debug
        existingParentIds
      );

      // Write both raw and processed data to debug output
      debugContext.data?.push({
        raw: bookmarkResponses,
        processed: {
          tweets: processedTweets,
          users: processedUsers,
          media: processedMedia,
        },
      });

      logger.complete(
        `Debug mode complete: ${processedTweets.length} tweets, ${processedUsers.length} users, ${processedMedia.length} media`
      );
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
