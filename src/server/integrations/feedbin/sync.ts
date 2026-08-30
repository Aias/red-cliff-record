import { feedEntries, feeds, type FeedEnclosure, type FeedInsert } from '@hozo';
import { inArray } from 'drizzle-orm';
import { Array as Arr, Config, Effect, Redacted, Schedule } from 'effect';
import { Database } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { makeApiClient } from '../runtime/http';
import {
  forEachCollect,
  requireRunId,
  type IntegrationDef,
  type ItemFailure,
  type SyncSummary,
} from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import {
  FeedbinEntriesResponseSchema,
  FeedbinEntryIdsResponseSchema,
  FeedbinFeedSchema,
  FeedbinIconsResponseSchema,
  FeedbinSubscriptionsResponseSchema,
  type FeedbinEntry,
  type FeedbinSubscription,
} from './types';

const API_BASE_URL = 'https://api.feedbin.com/v2';
const ENTRY_BATCH_SIZE = 100;
const ENTRY_CONCURRENCY = 30;
const FEED_CONCURRENCY = 10;
const MISSING_FEED_CONCURRENCY = 20;
const DB_CHUNK_SIZE = 1000;
const RECENT_LIMIT = 1000;
const FEED_TIMEOUT = '15 seconds';
const ENTRY_TIMEOUT = '30 seconds';
const STATUS_BATCH_TIMEOUT = '30 seconds';

const feedbinClient = Effect.gen(function* () {
  const username = yield* Config.redacted('FEEDBIN_USERNAME');
  const password = yield* Config.redacted('FEEDBIN_PASSWORD');
  const credentials = Buffer.from(
    `${Redacted.value(username)}:${Redacted.value(password)}`
  ).toString('base64');
  return yield* makeApiClient({
    baseUrl: API_BASE_URL,
    authorization: { scheme: 'Basic', token: Redacted.make(credentials) },
    rateLimit: { key: 'feedbin', limit: 120, window: '1 minute' },
  });
});

const secondAfter = (date: Date) => new Date(date.getTime() + 1000);

const fetchSubscriptions = (since: Date | null) =>
  Effect.gen(function* () {
    const client = yield* feedbinClient;
    const sink = yield* DebugSink;
    const response = yield* client.get(
      '/subscriptions.json',
      since ? { urlParams: { since: secondAfter(since).toISOString() } } : {}
    );
    const json = yield* response.json;
    yield* sink.capture(json);
    const subscriptions = yield* decodeZod(
      FeedbinSubscriptionsResponseSchema,
      'feedbin subscriptions'
    )(json);
    yield* Effect.logInfo(`Fetched ${subscriptions.length} subscriptions`);
    return subscriptions;
  });

const fetchIconMap = Effect.gen(function* () {
  const client = yield* feedbinClient;
  const sink = yield* DebugSink;
  const response = yield* client.get('/icons.json');
  const json = yield* response.json;
  yield* sink.capture(json);
  const icons = yield* decodeZod(FeedbinIconsResponseSchema, 'feedbin icons')(json);
  return new Map(icons.map((icon) => [icon.host, icon.url]));
});

const fetchEntryIds = (path: string, resource: string, since?: Date) =>
  Effect.gen(function* () {
    const client = yield* feedbinClient;
    const response = yield* client.get(
      path,
      since ? { urlParams: { since: since.toISOString() } } : {}
    );
    const json = yield* response.json;
    const ids = yield* decodeZod(FeedbinEntryIdsResponseSchema, resource)(json);
    yield* Effect.logInfo(`Fetched ${ids.length} ${resource}`);
    return ids;
  });

const decodeEntries = decodeZod(FeedbinEntriesResponseSchema, 'feedbin entries');

const fetchEntriesByIds = (ids: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const client = yield* feedbinClient;
    const sink = yield* DebugSink;
    const batches = yield* Effect.forEach(
      Arr.chunksOf(ids, ENTRY_BATCH_SIZE),
      (batch) =>
        Effect.gen(function* () {
          const response = yield* client.get('/entries.json', {
            urlParams: { ids: batch.join(','), mode: 'extended', include_enclosure: 'true' },
          });
          const json = yield* response.json;
          yield* sink.capture(json);
          return yield* decodeEntries(json);
        }),
      { concurrency: 4 }
    );
    const entries = batches.flat();
    yield* Effect.logInfo(`Fetched ${entries.length} entries`);
    return entries;
  });

const fetchFeed = (feedId: number) =>
  Effect.gen(function* () {
    const client = yield* feedbinClient;
    const response = yield* client.get(`/feeds/${feedId}.json`);
    const json = yield* response.json;
    return yield* decodeZod(FeedbinFeedSchema, `feedbin feed ${feedId}`)(json);
  });

const getRecentEntryStatuses = Effect.gen(function* () {
  const database = yield* Database;
  const rows = yield* database.use('feedEntries.recentStatuses', (client) =>
    client.query.feedEntries.findMany({
      columns: { id: true, read: true, starred: true },
      orderBy: { recordCreatedAt: 'desc' },
      limit: RECENT_LIMIT,
    })
  );
  return new Map(rows.map((row) => [row.id, { read: row.read, starred: row.starred }]));
});

const getRecentFeedIds = Effect.gen(function* () {
  const database = yield* Database;
  const rows = yield* database.use('feeds.recentIds', (client) =>
    client.query.feeds.findMany({
      columns: { id: true },
      orderBy: { recordCreatedAt: 'desc' },
      limit: RECENT_LIMIT,
    })
  );
  return new Set(rows.map((row) => row.id));
});

const getLastFeedSyncTime = Effect.gen(function* () {
  const database = yield* Database;
  const result = yield* database.use('feeds.lastContentCreatedAt', (client) =>
    client.query.feeds.findFirst({
      columns: { contentCreatedAt: true },
      where: { contentCreatedAt: { isNotNull: true } },
      orderBy: { contentCreatedAt: 'desc' },
    })
  );
  return result?.contentCreatedAt ?? null;
});

const getLastEntrySyncTime = Effect.gen(function* () {
  const database = yield* Database;
  const result = yield* database.use('integrationRuns.lastFeedbinSuccess', (client) =>
    client.query.integrationRuns.findFirst({
      columns: { runStartTime: true },
      where: { integrationType: 'feedbin', status: 'success' },
      orderBy: { runStartTime: 'desc' },
    })
  );
  return result?.runStartTime ?? null;
});

const getExistingEntryIds = (candidateIds: ReadonlyArray<number>) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const existing = new Set<number>();
    for (const chunk of Arr.chunksOf(candidateIds, DB_CHUNK_SIZE)) {
      const rows = yield* database.use('feedEntries.existingIds', (client) =>
        client.query.feedEntries.findMany({
          where: { id: { in: chunk } },
          columns: { id: true },
        })
      );
      for (const row of rows) existing.add(row.id);
    }
    return existing;
  });

interface EntryStatusChanges {
  readonly toStar: Array<number>;
  readonly toUnstar: Array<number>;
  readonly toMarkRead: Array<number>;
  readonly toMarkUnread: Array<number>;
}

const diffEntryStatuses = (
  existing: ReadonlyMap<number, { read: boolean; starred: boolean }>,
  unreadIds: ReadonlySet<number>,
  starredIds: ReadonlySet<number>
): EntryStatusChanges => {
  const toStar: Array<number> = [];
  const toUnstar: Array<number> = [];
  const toMarkRead: Array<number> = [];
  const toMarkUnread: Array<number> = [];
  for (const [id, status] of existing) {
    const shouldStar = starredIds.has(id);
    if (shouldStar && !status.starred) toStar.push(id);
    if (!shouldStar && status.starred) toUnstar.push(id);
    const shouldBeUnread = unreadIds.has(id);
    if (shouldBeUnread && status.read) toMarkUnread.push(id);
    if (!shouldBeUnread && !status.read) toMarkRead.push(id);
  }
  return { toStar, toUnstar, toMarkRead, toMarkUnread };
};

const applyStatusChanges = (changes: EntryStatusChanges) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const updates = [
      { action: 'unstar', ids: changes.toUnstar, set: { starred: false } },
      { action: 'star', ids: changes.toStar, set: { starred: true } },
      { action: 'markRead', ids: changes.toMarkRead, set: { read: true } },
      { action: 'markUnread', ids: changes.toMarkUnread, set: { read: false } },
    ].flatMap(({ action, ids, set }) =>
      Arr.chunksOf(ids, DB_CHUNK_SIZE).map((chunk, index) => ({
        label: `${action}:${index}`,
        chunk,
        set,
      }))
    );
    const result = yield* forEachCollect(updates, {
      concurrency: 1,
      label: (update) => update.label,
      worker: (update) =>
        database
          .use(`feedEntries.${update.label}`, (client) =>
            client
              .update(feedEntries)
              .set({ ...update.set, recordUpdatedAt: new Date() })
              .where(inArray(feedEntries.id, update.chunk))
          )
          .pipe(Effect.timeout(STATUS_BATCH_TIMEOUT)),
    });
    return result.failures;
  });

const iconUrlFor = (siteUrl: string | null | undefined, iconMap: ReadonlyMap<string, string>) => {
  if (!siteUrl) return null;
  try {
    return iconMap.get(new URL(siteUrl).hostname) ?? null;
  } catch {
    return null;
  }
};

const upsertFeed = (values: FeedInsert) =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.use(`feeds.upsert:${values.id}`, (client) =>
      client
        .insert(feeds)
        .values(values)
        .onConflictDoUpdate({
          target: feeds.id,
          set: {
            name: values.name,
            feedUrl: values.feedUrl,
            siteUrl: values.siteUrl,
            iconUrl: values.iconUrl,
            recordUpdatedAt: new Date(),
          },
        })
    );
  });

const persistFeeds = (
  subscriptions: ReadonlyArray<FeedbinSubscription>,
  iconMap: ReadonlyMap<string, string>
) =>
  Effect.gen(function* () {
    if (subscriptions.length === 0) return [];
    const result = yield* forEachCollect(subscriptions, {
      concurrency: FEED_CONCURRENCY,
      label: (subscription) => subscription.title,
      worker: (subscription) =>
        upsertFeed({
          id: subscription.feed_id,
          name: subscription.title,
          feedUrl: subscription.feed_url,
          siteUrl: subscription.site_url,
          iconUrl: iconUrlFor(subscription.site_url, iconMap),
          sources: ['feedbin'],
          contentCreatedAt: subscription.created_at,
        }).pipe(Effect.timeout(FEED_TIMEOUT)),
    });
    yield* Effect.logInfo(`Upserted ${result.successes.length} of ${subscriptions.length} feeds`);
    return result.failures;
  });

const syncMissingFeeds = (
  entries: ReadonlyArray<FeedbinEntry>,
  existingFeedIds: ReadonlySet<number>,
  iconMap: ReadonlyMap<string, string>
) =>
  Effect.gen(function* () {
    const missingFeedIds = [...new Set(entries.map((entry) => entry.feed_id))].filter(
      (id) => !existingFeedIds.has(id)
    );
    if (missingFeedIds.length === 0) return [];
    yield* Effect.logInfo(`Fetching ${missingFeedIds.length} missing feeds`);
    const result = yield* forEachCollect(missingFeedIds, {
      concurrency: MISSING_FEED_CONCURRENCY,
      label: (feedId) => `feed ${feedId}`,
      worker: (feedId) =>
        Effect.gen(function* () {
          const feed = yield* fetchFeed(feedId);
          yield* upsertFeed({
            id: feed.id,
            name: feed.title,
            feedUrl: feed.feed_url,
            siteUrl: feed.site_url,
            iconUrl: iconUrlFor(feed.site_url, iconMap),
            sources: ['feedbin'],
          });
        }).pipe(Effect.timeout(FEED_TIMEOUT)),
    });
    return result.failures;
  });

const normalizeEnclosure = (enclosure: FeedbinEntry['enclosure']): FeedEnclosure | null => {
  if (!enclosure) return null;
  if (
    enclosure.enclosure_type === 'false' ||
    enclosure.enclosure_type === false ||
    enclosure.enclosure_type === null
  ) {
    return null;
  }
  if (typeof enclosure.enclosure_url !== 'string' || !enclosure.enclosure_url) return null;
  return {
    enclosureUrl: enclosure.enclosure_url,
    enclosureType: typeof enclosure.enclosure_type === 'string' ? enclosure.enclosure_type : '',
    enclosureLength:
      typeof enclosure.enclosure_length === 'number' ? enclosure.enclosure_length : 0,
    itunesDuration: enclosure.itunes_duration || null,
    itunesImage: typeof enclosure.itunes_image === 'string' ? enclosure.itunes_image : null,
  };
};

const persistEntries = (
  entries: ReadonlyArray<FeedbinEntry>,
  unreadIds: ReadonlySet<number>,
  starredIds: ReadonlySet<number>,
  updatedEntryIds: ReadonlySet<number>,
  runId: number
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const withUrls: Array<{ entry: FeedbinEntry; url: string }> = [];
    for (const entry of entries) {
      const url = entry.url ?? entry.extracted_content_url ?? null;
      if (url) {
        withUrls.push({ entry, url });
      } else {
        yield* Effect.logWarning(
          `Skipping entry ${entry.id} (${entry.title ?? 'untitled'}): no URL`
        );
      }
    }
    const result = yield* forEachCollect(withUrls, {
      concurrency: ENTRY_CONCURRENCY,
      label: ({ entry }) => `entry ${entry.id}`,
      worker: ({ entry, url }) =>
        Effect.gen(function* () {
          let read = !unreadIds.has(entry.id);
          let starred = starredIds.has(entry.id);
          if (updatedEntryIds.has(entry.id)) {
            const existing = yield* database.use(`feedEntries.status:${entry.id}`, (client) =>
              client.query.feedEntries.findFirst({
                where: { id: entry.id },
                columns: { read: true, starred: true },
              })
            );
            if (existing) {
              read = existing.read;
              starred = existing.starred;
            }
          }
          const imageUrls = entry.images?.original_url ? [entry.images.original_url] : null;
          const enclosure = normalizeEnclosure(entry.enclosure);
          yield* database.use(`feedEntries.upsert:${entry.id}`, (client) =>
            client
              .insert(feedEntries)
              .values({
                id: entry.id,
                feedId: entry.feed_id,
                url,
                title: entry.title,
                author: entry.author,
                summary: entry.summary,
                content: entry.content,
                imageUrls,
                enclosure,
                read,
                starred,
                publishedAt: entry.published,
                integrationRunId: runId,
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
                  read,
                  starred,
                  publishedAt: entry.published,
                  recordUpdatedAt: new Date(),
                },
              })
          );
        }).pipe(
          Effect.retry({ schedule: Schedule.exponential('1 second'), times: 3 }),
          Effect.timeout(ENTRY_TIMEOUT)
        ),
    });
    yield* Effect.logInfo(
      `Upserted ${result.successes.length} of ${entries.length} entries (${entries.length - withUrls.length} skipped)`
    );
    return {
      entriesCreated: result.successes.length,
      failures: result.failures,
    } satisfies SyncSummary;
  });

const sync = Effect.gen(function* () {
  const sink = yield* DebugSink;
  const [entryStatuses, existingFeedIds, lastFeedSyncTime, lastEntrySyncTime] = yield* Effect.all(
    [getRecentEntryStatuses, getRecentFeedIds, getLastFeedSyncTime, getLastEntrySyncTime],
    { concurrency: 4 }
  );
  yield* Effect.logInfo(
    `Last feed sync: ${lastFeedSyncTime?.toISOString() ?? 'never'}; last entry sync: ${lastEntrySyncTime?.toISOString() ?? 'never'}`
  );
  const [subscriptions, iconMap] = yield* Effect.all(
    [fetchSubscriptions(lastFeedSyncTime), fetchIconMap],
    { concurrency: 2 }
  );
  const [unreadIds, starredIds, recentlyReadIds, updatedIds] = yield* Effect.all(
    [
      fetchEntryIds('/unread_entries.json', 'unread entry IDs'),
      fetchEntryIds('/starred_entries.json', 'starred entry IDs'),
      fetchEntryIds('/recently_read_entries.json', 'recently read entry IDs'),
      fetchEntryIds('/updated_entries.json', 'updated entry IDs', lastEntrySyncTime ?? undefined),
    ],
    { concurrency: 4 }
  );
  const unreadSet = new Set(unreadIds);
  const starredSet = new Set(starredIds);
  const changes = diffEntryStatuses(entryStatuses, unreadSet, starredSet);
  yield* Effect.logInfo(
    `Status changes: ${changes.toStar.length} starred, ${changes.toUnstar.length} unstarred, ${changes.toMarkRead.length} read, ${changes.toMarkUnread.length} unread`
  );
  const idsToConsider = new Set([...unreadSet, ...recentlyReadIds, ...starredSet]);
  const existingEntryIds = yield* getExistingEntryIds([
    ...new Set([...idsToConsider, ...updatedIds]),
  ]);
  const newEntryIds = [...idsToConsider].filter((id) => !existingEntryIds.has(id));
  const updatedEntryIds = updatedIds.filter((id) => existingEntryIds.has(id));
  yield* Effect.logInfo(
    `${newEntryIds.length} new entries to fetch, ${updatedEntryIds.length} updated entries to re-fetch`
  );
  const entries = yield* fetchEntriesByIds([...newEntryIds, ...updatedEntryIds]);
  if (sink.enabled) {
    yield* Effect.logInfo('Debug mode: skipping database writes');
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  const runId = yield* requireRunId;
  const feedFailures: Array<ItemFailure> = yield* persistFeeds(subscriptions, iconMap);
  const statusFailures = yield* applyStatusChanges(changes);
  const missingFeedFailures = yield* syncMissingFeeds(entries, existingFeedIds, iconMap);
  const entrySummary = yield* persistEntries(
    entries,
    unreadSet,
    starredSet,
    new Set(updatedEntryIds),
    runId
  );
  return {
    entriesCreated: entrySummary.entriesCreated,
    failures: [
      ...feedFailures,
      ...statusFailures,
      ...missingFeedFailures,
      ...entrySummary.failures,
    ],
  } satisfies SyncSummary;
});

export const feedbinIntegration: IntegrationDef = {
  integrationType: 'feedbin',
  sync,
};
