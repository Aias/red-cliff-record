import {
  raindropBookmarks,
  raindropCollections,
  raindropHighlights,
  raindropImages,
  RaindropTypeSchema,
  type RaindropBookmarkInsert,
  type RaindropCollectionInsert,
  type RaindropHighlightInsert,
} from '@hozo';
import { Config, Effect, Option, Stream } from 'effect';
import type { z } from 'zod';
import { Database, legacyOperation } from '../runtime/db';
import { DebugSink } from '../runtime/debug';
import { makeApiClient } from '../runtime/http';
import {
  forEachCollect,
  requireRunId,
  type IntegrationDef,
  type SyncSummary,
} from '../runtime/run';
import { decodeZod } from '../runtime/zod';
import {
  createMediaFromRaindropBookmarks,
  createRaindropTags,
  createRecordsFromRaindropBookmarks,
  createRecordsFromRaindropHighlights,
  createRecordsFromRaindropTags,
} from './map';
import { CollectionsResponseSchema, RaindropResponseSchema, type Raindrop } from './types';

const API_BASE_URL = 'https://api.raindrop.io/rest/v1';
const RAINDROPS_PAGE_SIZE = 50;
const DB_CONCURRENCY = 10;

type RaindropCollection = z.infer<typeof CollectionsResponseSchema>['items'][number];

const decodeCollections = decodeZod(CollectionsResponseSchema, 'raindrop collections');
const decodeRaindrops = decodeZod(RaindropResponseSchema, 'raindrop bookmarks');

const raindropClient = Effect.gen(function* () {
  const token = yield* Config.redacted('RAINDROP_TEST_TOKEN');
  return yield* makeApiClient({
    baseUrl: API_BASE_URL,
    authorization: { scheme: 'Bearer', token },
    rateLimit: { key: 'raindrop', limit: 120, window: '1 minute' },
  });
});

/** Collections have no cursor and are always fully re-fetched (root + children). */
const fetchCollections = Effect.gen(function* () {
  const client = yield* raindropClient;
  const sink = yield* DebugSink;
  const fetchPath = (path: string) =>
    Effect.gen(function* () {
      const response = yield* client.get(path);
      const json = yield* response.json;
      yield* sink.capture(json);
      const parsed = yield* decodeCollections(json);
      return parsed.items;
    });
  const root = yield* fetchPath('/collections');
  const children = yield* fetchPath('/collections/childrens');
  const all = [...root, ...children];
  yield* Effect.logInfo(`Retrieved ${all.length} total collections`);
  return all;
});

const getLastSyncDate = Effect.gen(function* () {
  const database = yield* Database;
  const latest = yield* database.use('raindropBookmarks.lastUpdated', (client) =>
    client.query.raindropBookmarks.findFirst({
      columns: { contentUpdatedAt: true },
      orderBy: { contentUpdatedAt: 'desc' },
    })
  );
  yield* Effect.logInfo(
    `Last known raindrop date: ${latest?.contentUpdatedAt?.toISOString() ?? 'none'}`
  );
  return latest?.contentUpdatedAt ?? undefined;
});

const fetchNewRaindrops = (lastKnownDate: Date | undefined) =>
  Effect.gen(function* () {
    const client = yield* raindropClient;
    const sink = yield* DebugSink;
    const pages = Stream.paginate(0, (page: number) =>
      Effect.gen(function* () {
        const response = yield* client.get('/raindrops/0', {
          urlParams: { perpage: String(RAINDROPS_PAGE_SIZE), page: String(page) },
        });
        const json = yield* response.json;
        yield* sink.capture(json);
        const parsed = yield* decodeRaindrops(json);
        yield* Effect.logInfo(`Retrieved ${parsed.items.length} raindrops (page ${page + 1})`);
        // Stop once a page reaches raindrops at or before the last known date,
        // keeping only the newer items from that page
        const reachedExisting = parsed.items.some(
          ({ lastUpdate }) => lastKnownDate && lastUpdate <= lastKnownDate
        );
        if (reachedExisting) {
          const newItems = parsed.items.filter(
            ({ lastUpdate }) => !lastKnownDate || lastUpdate > lastKnownDate
          );
          return [newItems, Option.none<number>()] as const;
        }
        return [
          parsed.items,
          parsed.items.length === RAINDROPS_PAGE_SIZE
            ? Option.some(page + 1)
            : Option.none<number>(),
        ] as const;
      })
    );
    return yield* Stream.runCollect(pages);
  });

const upsertCollection = (collection: RaindropCollection, runId: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const collectionToInsert: RaindropCollectionInsert = {
      id: collection._id,
      title: collection.title,
      parentId: collection.parent?.$id,
      colorHex: collection.color,
      coverUrl: collection.cover[0],
      raindropCount: collection.count,
      contentCreatedAt: collection.created,
      contentUpdatedAt: collection.lastUpdate,
      integrationRunId: runId,
    };
    yield* database.use(`raindropCollections.upsert:${collection._id}`, (client) =>
      client
        .insert(raindropCollections)
        .values(collectionToInsert)
        .onConflictDoUpdate({
          target: raindropCollections.id,
          set: { ...collectionToInsert, recordUpdatedAt: new Date() },
        })
    );
  });

/**
 * Upserts one bookmark with its cover image and highlights atomically. Each
 * bookmark gets its own transaction so one bad bookmark cannot poison the
 * rest of the batch.
 */
const upsertRaindrop = (raindrop: Raindrop, runId: number) =>
  Effect.gen(function* () {
    const database = yield* Database;
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
      integrationRunId: runId,
    };
    yield* database.use(`raindropBookmarks.upsert:${bookmarkId}`, (client) =>
      client.transaction(async (tx) => {
        await tx
          .insert(raindropBookmarks)
          .values(insertData)
          .onConflictDoUpdate({
            target: raindropBookmarks.id,
            set: { ...insertData, recordUpdatedAt: new Date() },
          });
        if (raindrop.cover) {
          const [coverImage] = await tx
            .insert(raindropImages)
            .values({ url: raindrop.cover, bookmarkId })
            .returning();
          if (!coverImage) {
            throw new Error('Failed to insert cover image');
          }
        }
        for (const highlight of raindrop.highlights ?? []) {
          const highlightData: RaindropHighlightInsert = {
            id: highlight._id,
            text: highlight.text,
            note: highlight.note,
            bookmarkId,
            contentCreatedAt: highlight.created,
            contentUpdatedAt: highlight.lastUpdate,
          };
          await tx
            .insert(raindropHighlights)
            .values(highlightData)
            .onConflictDoUpdate({
              target: raindropHighlights.id,
              set: { ...highlightData, recordUpdatedAt: new Date() },
            });
        }
      })
    );
  });

const persistAll = (
  collections: ReadonlyArray<RaindropCollection>,
  raindrops: ReadonlyArray<Raindrop>
) =>
  Effect.gen(function* () {
    const runId = yield* requireRunId;
    const collectionResults = yield* forEachCollect(collections, {
      concurrency: 5,
      label: (collection) => String(collection._id),
      worker: (collection) => upsertCollection(collection, runId),
    });
    yield* Effect.logInfo(
      `Upserted ${collectionResults.successes.length} of ${collections.length} collections`
    );
    const raindropResults = yield* forEachCollect(raindrops, {
      concurrency: DB_CONCURRENCY,
      label: (raindrop) => String(raindrop._id),
      worker: (raindrop) => upsertRaindrop(raindrop, runId),
    });
    yield* Effect.logInfo(
      `Upserted ${raindropResults.successes.length} of ${raindrops.length} raindrops`
    );
    // Tags and media are independent of each other; records then depend on both
    yield* Effect.all(
      [
        legacyOperation('raindrop.tags', () => createRaindropTags(runId)),
        legacyOperation('raindrop.media', () => createMediaFromRaindropBookmarks()),
      ],
      { concurrency: 2 }
    );
    yield* legacyOperation('raindrop.tagRecords', () => createRecordsFromRaindropTags());
    yield* legacyOperation('raindrop.bookmarkRecords', () => createRecordsFromRaindropBookmarks());
    yield* legacyOperation('raindrop.highlightRecords', () =>
      createRecordsFromRaindropHighlights()
    );
    return {
      entriesCreated: collectionResults.successes.length + raindropResults.successes.length,
      failures: [...collectionResults.failures, ...raindropResults.failures],
    } satisfies SyncSummary;
  });

const sync = Effect.gen(function* () {
  const collections = yield* fetchCollections;
  const lastKnownDate = yield* getLastSyncDate;
  const raindrops = yield* fetchNewRaindrops(lastKnownDate);
  yield* Effect.logInfo(
    `Fetched ${collections.length} collections and ${raindrops.length} new raindrops`
  );
  const sink = yield* DebugSink;
  if (sink.enabled) {
    yield* Effect.logInfo('Debug mode: skipping database writes');
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  return yield* persistAll(collections, raindrops);
});

export const raindropIntegration: IntegrationDef = {
  integrationType: 'raindrop',
  sync,
};
