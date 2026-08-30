import {
  twitterMedia,
  twitterTweets,
  twitterUsers,
  type TwitterMediaInsert,
  type TwitterTweetInsert,
  type TwitterUserInsert,
} from '@hozo';
import { Array as Arr, Effect, Result } from 'effect';
import { Database, legacyOperation } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { ApiRequestError, describeError } from '../runtime/errors';
import {
  forEachCollect,
  requireRunId,
  type IntegrationDef,
  type SyncSummary,
} from '../runtime/run';
import { twitterClient } from './client';
import { processMedia, processTweet, processUser } from './helpers';
import {
  createMediaFromTweets,
  createRecordsFromTweets,
  createRecordsFromTwitterUsers,
} from './map';
import {
  extractTweetId,
  isTweet,
  isTweetWithVisibilityResults,
  TimelineItemSchema,
  type TimelineItem,
  type TweetData,
} from './types';

const RECENT_TWEET_LIMIT = 200;
const PARENT_FETCH_CONCURRENCY = 3;
const DB_CHUNK_SIZE = 1000;
const MEDIA_INSERT_CHUNK_SIZE = 500;

type TweetRow = Omit<TwitterTweetInsert, 'integrationRunId'>;
type UserRow = Omit<TwitterUserInsert, 'integrationRunId'>;
type MediaRow = Omit<TwitterMediaInsert, 'integrationRunId'>;

const getRecentTweetIds = Effect.gen(function* () {
  const database = yield* Database;
  const rows = yield* database.use('twitterTweets.recentIds', (client) =>
    client.query.twitterTweets.findMany({
      columns: { id: true },
      orderBy: { recordCreatedAt: 'desc' },
      limit: RECENT_TWEET_LIMIT,
    })
  );
  return new Set(rows.map((row) => row.id));
});

const getTweetIdsInDb = (tweetIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    if (tweetIds.length === 0) return new Set<string>();
    const database = yield* Database;
    const rows = yield* database.use('twitterTweets.existingIds', (client) =>
      client.query.twitterTweets.findMany({
        where: { id: { in: [...tweetIds] } },
        columns: { id: true },
      })
    );
    return new Set(rows.map((row) => row.id));
  });

const fetchAllBookmarks = (knownTweetIds: ReadonlySet<string>) =>
  Effect.gen(function* () {
    const api = yield* twitterClient;
    const items: Array<TimelineItem> = [];
    let cursor: string | undefined;
    let pages = 0;
    while (true) {
      const result = yield* api.fetchBookmarksPage(cursor).pipe(Effect.result);
      if (Result.isFailure(result)) {
        if (pages === 0) return yield* Effect.fail(result.failure);
        yield* Effect.logWarning(
          `Stopping pagination after error: ${describeError(result.failure)}`
        );
        break;
      }
      const page = result.success;
      pages++;
      items.push(...page.items);
      yield* Effect.logInfo(`Fetched bookmarks page ${pages} (${page.items.length} items)`);
      const foundKnown = page.items.some((item) => {
        const id = extractTweetId(item);
        return id !== undefined && knownTweetIds.has(id);
      });
      if (foundKnown) {
        yield* Effect.logInfo(`Found known tweet on page ${pages}, stopping pagination`);
        break;
      }
      if (!page.nextCursor || page.nextCursor === cursor) break;
      cursor = page.nextCursor;
    }
    yield* Effect.logInfo(`Fetched ${pages} pages of bookmarks (${items.length} timeline items)`);
    return items;
  });

const extractTweets = (items: ReadonlyArray<TimelineItem>): Array<TweetData> => {
  const tweets: Array<TweetData> = [];
  for (const item of items) {
    const tweet = isTweetWithVisibilityResults(item) ? item.tweet : isTweet(item) ? item : null;
    if (!tweet) continue;
    const { quoted_status_result, ...mainTweet } = tweet;
    const quotedParsed =
      quoted_status_result?.result !== undefined
        ? TimelineItemSchema.safeParse(quoted_status_result.result)
        : undefined;
    if (quotedParsed?.success) {
      const quotedItem = quotedParsed.data;
      const quotedTweet = isTweetWithVisibilityResults(quotedItem)
        ? quotedItem.tweet
        : isTweet(quotedItem)
          ? quotedItem
          : null;
      if (quotedTweet) {
        tweets.push({ ...quotedTweet, isQuoted: true });
        tweets.push({ ...mainTweet, quotedTweetId: quotedTweet.rest_id });
        continue;
      }
    }
    tweets.push(mainTweet);
  }
  return tweets;
};

const fetchMissingParentTweets = (
  tweets: ReadonlyArray<TweetData>,
  knownExistingIds: ReadonlySet<string>
) =>
  Effect.gen(function* () {
    const batchTweetIds = new Set(tweets.map((tweet) => tweet.rest_id));
    const parentIds = new Set<string>();
    for (const tweet of tweets) {
      const replyToId = tweet.legacy.in_reply_to_status_id_str;
      if (!replyToId) continue;
      const conversationId = tweet.legacy.conversation_id_str;
      if (conversationId && conversationId !== tweet.rest_id) {
        yield* Effect.logInfo(`Tweet ${tweet.rest_id} is part of thread ${conversationId}`);
      }
      yield* Effect.logInfo(`Tweet ${tweet.rest_id} replies to ${replyToId}`);
      if (!batchTweetIds.has(replyToId) && !knownExistingIds.has(replyToId)) {
        parentIds.add(replyToId);
      }
    }
    if (parentIds.size === 0) {
      return {
        parentTweets: [],
        existingParentIds: new Set(knownExistingIds),
        failures: [],
      };
    }
    yield* Effect.logInfo(`Fetching ${parentIds.size} parent tweets`);
    const api = yield* twitterClient;
    const result = yield* forEachCollect([...parentIds], {
      concurrency: PARENT_FETCH_CONCURRENCY,
      label: (parentId) => `parent tweet ${parentId}`,
      worker: (parentId) =>
        Effect.gen(function* () {
          const item = yield* api.fetchTweetById(parentId);
          const tweet = isTweetWithVisibilityResults(item)
            ? item.tweet
            : isTweet(item)
              ? item
              : null;
          if (!tweet) {
            return yield* Effect.fail(
              new ApiRequestError({
                resource: `twitter parent ${parentId}`,
                cause: new Error(`Not a usable tweet type: ${item.__typename}`),
              })
            );
          }
          return { ...tweet, isQuoted: false } satisfies TweetData;
        }),
    });
    const fetchedIds = new Set(result.successes.map((tweet) => tweet.rest_id));
    const failedIds = [...parentIds].filter((id) => !fetchedIds.has(id));
    let existingFromFailed = new Set<string>();
    if (failedIds.length > 0) {
      const database = yield* Database;
      const rows = yield* database.use('twitterTweets.failedParents', (client) =>
        client.query.twitterTweets.findMany({
          where: { id: { in: failedIds } },
          columns: { id: true },
        })
      );
      existingFromFailed = new Set(rows.map((row) => row.id));
    }
    yield* Effect.logInfo(
      `Fetched ${result.successes.length} parent tweets, ${failedIds.length} failed (${existingFromFailed.size} of those already in DB)`
    );
    return {
      parentTweets: result.successes,
      existingParentIds: new Set([...knownExistingIds, ...existingFromFailed]),
      failures: result.failures,
    };
  });

const topologicalSortTweets = (tweets: ReadonlyArray<TweetRow>): Array<TweetRow> => {
  const tweetMap = new Map(tweets.map((tweet) => [tweet.id, tweet]));
  const sorted: Array<TweetRow> = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (tweet: TweetRow) => {
    if (visited.has(tweet.id)) return;
    if (visiting.has(tweet.id)) {
      visited.add(tweet.id);
      sorted.push(tweet);
      return;
    }
    visiting.add(tweet.id);
    const parent = tweet.inReplyToTweetId ? tweetMap.get(tweet.inReplyToTweetId) : undefined;
    if (parent) visit(parent);
    const quoted = tweet.quotedTweetId ? tweetMap.get(tweet.quotedTweetId) : undefined;
    if (quoted) visit(quoted);
    visiting.delete(tweet.id);
    visited.add(tweet.id);
    sorted.push(tweet);
  };
  for (const tweet of tweets) visit(tweet);
  return sorted;
};

interface ProcessedTweetData {
  readonly tweets: Array<TweetRow>;
  readonly users: Array<UserRow>;
  readonly media: Array<MediaRow>;
}

const processTweetData = (
  tweets: ReadonlyArray<TweetData>,
  existingParentIds: ReadonlySet<string>
): Effect.Effect<ProcessedTweetData> =>
  Effect.gen(function* () {
    const usersById = new Map<string, UserRow>();
    const mediaById = new Map<string, MediaRow>();
    const tweetsById = new Map<string, TweetRow>();
    const quoteTweetsById = new Map<string, TweetRow>();
    const validReplyTargets = new Set(existingParentIds);
    for (const tweet of tweets) {
      validReplyTargets.add(tweet.rest_id);
    }
    for (const tweetData of tweets) {
      const userResult = tweetData.core.user_results.result;
      const user = processUser(userResult);
      if (!user) {
        const username = userResult.core?.screen_name ?? userResult.legacy.screen_name ?? 'unknown';
        const displayName = userResult.core?.name ?? userResult.legacy.name ?? 'unknown';
        yield* Effect.logWarning(
          `Skipping tweet ${tweetData.rest_id}: user missing required fields (id=${userResult.rest_id}, username=${username}, name=${displayName})`
        );
        continue;
      }
      const tweet = processTweet(tweetData);
      const validReplyToId =
        tweet.inReplyToTweetId && validReplyTargets.has(tweet.inReplyToTweetId)
          ? tweet.inReplyToTweetId
          : undefined;
      if (tweet.inReplyToTweetId && !validReplyToId) {
        yield* Effect.logWarning(
          `Tweet ${tweet.id} replies to ${tweet.inReplyToTweetId} but parent not in DB, clearing inReplyToTweetId`
        );
      }
      const row: TweetRow = { ...tweet, inReplyToTweetId: validReplyToId };
      if (row.quotedTweetId) {
        tweetsById.delete(row.id);
        if (!quoteTweetsById.has(row.id)) {
          quoteTweetsById.set(row.id, row);
        }
      } else if (!quoteTweetsById.has(row.id) && !tweetsById.has(row.id)) {
        tweetsById.set(row.id, row);
      }
      if (!usersById.has(user.id)) {
        usersById.set(user.id, user);
      }
      for (const mediaEntity of tweetData.legacy.entities?.media ?? []) {
        const mediaRow = processMedia(mediaEntity, tweetData);
        if (!mediaById.has(mediaRow.id)) {
          mediaById.set(mediaRow.id, mediaRow);
        }
      }
    }
    return {
      tweets: topologicalSortTweets([...tweetsById.values(), ...quoteTweetsById.values()]),
      users: [...usersById.values()],
      media: [...mediaById.values()],
    };
  });

const storeTweetData = (data: ProcessedTweetData, runId: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const counts = yield* database.use('twitter.store', (client) =>
      client.transaction(
        async (tx) => {
          const findExisting = async (
            fetchChunk: (chunk: Array<string>) => Promise<Array<{ id: string }>>,
            ids: Array<string>
          ) => {
            const existing = new Set<string>();
            for (const chunk of Arr.chunksOf(ids, DB_CHUNK_SIZE)) {
              for (const row of await fetchChunk(chunk)) {
                existing.add(row.id);
              }
            }
            return existing;
          };
          const existingUserIds = await findExisting(
            (chunk) =>
              tx.query.twitterUsers.findMany({
                where: { id: { in: chunk } },
                columns: { id: true },
              }),
            data.users.map((user) => user.id)
          );
          for (const user of data.users) {
            const values = { ...user, integrationRunId: runId };
            await tx
              .insert(twitterUsers)
              .values(values)
              .onConflictDoUpdate({
                target: twitterUsers.id,
                set: { ...values, recordUpdatedAt: new Date() },
              });
          }
          const existingTweetIds = await findExisting(
            (chunk) =>
              tx.query.twitterTweets.findMany({
                where: { id: { in: chunk } },
                columns: { id: true },
              }),
            data.tweets.map((tweet) => tweet.id)
          );
          for (const tweet of data.tweets) {
            const values = { ...tweet, integrationRunId: runId };
            await tx
              .insert(twitterTweets)
              .values(values)
              .onConflictDoUpdate({
                target: twitterTweets.id,
                set: { ...values, recordUpdatedAt: new Date() },
              });
          }
          const existingMediaIds = await findExisting(
            (chunk) =>
              tx.query.twitterMedia.findMany({
                where: { id: { in: chunk } },
                columns: { id: true },
              }),
            data.media.map((media) => media.id)
          );
          const newMedia = data.media.filter((media) => !existingMediaIds.has(media.id));
          for (const chunk of Arr.chunksOf(newMedia, MEDIA_INSERT_CHUNK_SIZE)) {
            await tx.insert(twitterMedia).values(chunk).onConflictDoNothing();
          }
          return {
            users: { total: data.users.length, existing: existingUserIds.size },
            tweets: { total: data.tweets.length, existing: existingTweetIds.size },
            media: { total: data.media.length, inserted: newMedia.length },
          };
        },
        { isolationLevel: 'read committed' }
      )
    );
    yield* Effect.logInfo(
      `Stored ${counts.tweets.total} tweets (${counts.tweets.existing} existing), ${counts.users.total} users (${counts.users.existing} existing), ${counts.media.inserted} new media of ${counts.media.total}`
    );
    return counts.tweets.total;
  });

const sync = Effect.gen(function* () {
  const sink = yield* DebugSink;
  const recentTweetIds = yield* getRecentTweetIds;
  yield* Effect.logInfo(`Loaded ${recentTweetIds.size} recent tweet IDs for incremental sync`);
  const items = yield* fetchAllBookmarks(recentTweetIds);
  const extracted = extractTweets(items);
  yield* Effect.logInfo(`Extracted ${extracted.length} tweets from bookmarks`);
  const existingTweetIds = yield* getTweetIdsInDb(extracted.map((tweet) => tweet.rest_id));
  const newTweets = extracted.filter((tweet) => !existingTweetIds.has(tweet.rest_id));
  yield* Effect.logInfo(
    `Filtered to ${newTweets.length} new tweets (${existingTweetIds.size} already in DB)`
  );
  if (newTweets.length === 0) {
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  const parents = yield* fetchMissingParentTweets(newTweets, existingTweetIds);
  const allTweets = [...parents.parentTweets, ...newTweets];
  const processed = yield* processTweetData(allTweets, parents.existingParentIds);
  if (sink.enabled) {
    yield* Effect.logInfo(
      `Debug mode: skipping database writes for ${processed.tweets.length} tweets`
    );
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  const runId = yield* requireRunId;
  const entriesCreated = yield* storeTweetData(processed, runId);
  yield* legacyOperation('twitter.userRecords', () => createRecordsFromTwitterUsers());
  yield* legacyOperation('twitter.tweetRecords', () => createRecordsFromTweets());
  yield* legacyOperation('twitter.media', () => createMediaFromTweets());
  return { entriesCreated, failures: parents.failures } satisfies SyncSummary;
});

export const twitterIntegration: IntegrationDef = {
  integrationType: 'twitter',
  sync,
};
