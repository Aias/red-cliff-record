import { readwiseDocuments, type ReadwiseDocumentInsert } from '@hozo';
import { Config, Effect, Option, Stream, Tuple } from 'effect';
import { Database, legacyOperation } from '../runtime/db';
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
import { cleanupDocuments, formatNewHighlights } from './cleanup/sync';
import {
  createReadwiseAuthors,
  createReadwiseTags,
  createRecordsFromReadwiseAuthors,
  createRecordsFromReadwiseDocuments,
  createRecordsFromReadwiseTags,
} from './map';
import { ReadwiseArticlesResponseSchema, type ReadwiseArticle } from './types';

const API_BASE_URL = 'https://readwise.io/api/v3';
const DB_CONCURRENCY = 10;

const decodePage = decodeZod(ReadwiseArticlesResponseSchema, 'readwise documents');

const readwiseClient = Effect.gen(function* () {
  const token = yield* Config.redacted('READWISE_TOKEN');
  return yield* makeApiClient({
    baseUrl: API_BASE_URL,
    authorization: { scheme: 'Token', token },
    rateLimit: { key: 'readwise', limit: 20, window: '1 minute' },
  });
});

const getMostRecentUpdateTime = Effect.gen(function* () {
  const database = yield* Database;
  const mostRecent = yield* database.use('readwiseDocuments.lastUpdated', (client) =>
    client.query.readwiseDocuments.findFirst({
      columns: { contentUpdatedAt: true },
      orderBy: { contentUpdatedAt: 'desc' },
    })
  );
  yield* Effect.logInfo(
    `Last known readwise date: ${mostRecent?.contentUpdatedAt?.toISOString() ?? 'none'}`
  );
  return mostRecent?.contentUpdatedAt ?? null;
});

const justAfter = (date: Date) => new Date(date.getTime() + 1);
const firstPageCursor = (): string | null => null;

const fetchAllDocuments = (updatedAfter: Date | null) =>
  Effect.gen(function* () {
    const client = yield* readwiseClient;
    const sink = yield* DebugSink;
    const pages = Stream.paginate(firstPageCursor(), (pageCursor) =>
      Effect.gen(function* () {
        const urlParams: Record<string, string> = { withHtmlContent: 'true' };
        if (pageCursor) urlParams.pageCursor = pageCursor;
        if (updatedAfter) {
          urlParams.updatedAfter = justAfter(updatedAfter).toISOString();
        }
        const response = yield* client.get('/list/', { urlParams });
        const json = yield* response.json;
        yield* sink.capture(json);
        const page = yield* decodePage(json);
        yield* Effect.logInfo(`Retrieved ${page.results.length} documents`);
        return Tuple.make(
          page.results,
          page.nextPageCursor ? Option.some(page.nextPageCursor) : Option.none<string | null>()
        );
      })
    );
    return yield* Stream.runCollect(pages);
  });

const validHttpUrl = (value: string | null | undefined): string | null => {
  if (!value || !/^https?:\/\//.test(value)) return null;
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
};

const mapReadwiseArticleToDocument = (
  article: ReadwiseArticle,
  integrationRunId: number
): ReadwiseDocumentInsert => {
  return {
    id: article.id,
    parentId: article.parent_id,
    url: article.url,
    title: article.title || null,
    author: article.author || null,
    source: article.source,
    category: article.category,
    location: article.location,
    tags: article.tags,
    siteName: article.site_name || null,
    wordCount: article.word_count,
    summary: article.summary || null,
    content: article.content || null,
    htmlContent: article.html_content || null,
    notes: article.notes || null,
    imageUrl: validHttpUrl(article.image_url),
    sourceUrl: validHttpUrl(article.source_url),
    readingProgress: article.reading_progress.toString(),
    firstOpenedAt: article.first_opened_at,
    lastOpenedAt: article.last_opened_at,
    savedAt: article.saved_at,
    lastMovedAt: article.last_moved_at,
    publishedDate: article.published_date
      ? article.published_date.toISOString().split('T')[0]
      : null,
    contentCreatedAt: article.created_at,
    contentUpdatedAt: article.updated_at,
    integrationRunId,
  };
};

function getDocumentDepth(
  doc: ReadwiseArticle,
  idToDocument: Map<string, ReadwiseArticle>
): number {
  let depth = 0;
  let current = doc;
  while (current.parent_id) {
    const parent = idToDocument.get(current.parent_id);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}

function sortDocumentsByHierarchy(documents: ReadonlyArray<ReadwiseArticle>): ReadwiseArticle[] {
  const idToDocument = new Map(documents.map((doc) => [doc.id, doc]));
  return [...documents].sort((a, b) => {
    const aDepth = getDocumentDepth(a, idToDocument);
    const bDepth = getDocumentDepth(b, idToDocument);
    if (aDepth !== bDepth) {
      return aDepth - bDepth;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function groupDocumentsByDepth(documents: ReadonlyArray<ReadwiseArticle>): ReadwiseArticle[][] {
  const idToDocument = new Map(documents.map((doc) => [doc.id, doc]));
  const levels: ReadwiseArticle[][] = [];
  for (const doc of documents) {
    const depth = getDocumentDepth(doc, idToDocument);
    const level = levels[depth] ?? [];
    level.push(doc);
    levels[depth] = level;
  }
  return levels;
}

const persistDocuments = (documents: ReadonlyArray<ReadwiseArticle>) =>
  Effect.gen(function* () {
    const runId = yield* requireRunId;
    const database = yield* Database;
    const levels = groupDocumentsByDepth(sortDocumentsByHierarchy(documents));
    let entriesCreated = 0;
    const failures: Array<ItemFailure> = [];
    for (const level of levels) {
      const result = yield* forEachCollect(level, {
        concurrency: DB_CONCURRENCY,
        label: (doc) => doc.id,
        worker: (doc) => {
          const documentToInsert = mapReadwiseArticleToDocument(doc, runId);
          return database.use(`readwiseDocuments.upsert:${doc.id}`, (client) =>
            client
              .insert(readwiseDocuments)
              .values(documentToInsert)
              .onConflictDoUpdate({
                target: readwiseDocuments.id,
                set: { ...documentToInsert, recordUpdatedAt: new Date() },
              })
          );
        },
      });
      entriesCreated += result.successes.length;
      failures.push(...result.failures);
    }
    yield* Effect.logInfo(`Upserted ${entriesCreated} of ${documents.length} documents`);
    const formatted = yield* formatNewHighlights();
    failures.push(...formatted.failures);
    yield* Effect.all(
      [
        legacyOperation('readwise.authors', async () => {
          await createReadwiseAuthors();
          await createRecordsFromReadwiseAuthors();
        }),
        legacyOperation('readwise.tags', async () => {
          await createReadwiseTags(runId);
          await createRecordsFromReadwiseTags();
        }),
      ],
      { concurrency: 2 }
    );
    const created = yield* database.use('readwise.documents', () =>
      createRecordsFromReadwiseDocuments(runId, formatted.readyHighlightIds)
    );
    const mode = yield* Config.literals(['preview', 'automatic'], 'READWISE_CLEANUP_MODE').pipe(
      Config.withDefault('preview')
    );
    if (mode === 'automatic' && created.recordIds.length) {
      const parents = yield* database.use('readwise.newHighlightParents', (client) =>
        client.query.readwiseDocuments.findMany({
          where: { recordId: { in: created.recordIds }, category: 'highlight' },
          columns: { id: true },
          with: { parent: { columns: { recordId: true } } },
        })
      );
      const parentRecordIds = [
        ...new Set(parents.flatMap((row) => (row.parent?.recordId ? [row.parent.recordId] : []))),
      ];
      failures.push(
        ...(yield* cleanupDocuments(parentRecordIds, {
          onlyRecordIds: new Set(created.recordIds),
          nativeByParent: formatted.nativeByParent,
        }))
      );
    }
    return { entriesCreated, failures } satisfies SyncSummary;
  });

const sync = Effect.gen(function* () {
  const lastUpdateTime = yield* getMostRecentUpdateTime;
  const documents = yield* fetchAllDocuments(lastUpdateTime);
  yield* Effect.logInfo(`Fetched ${documents.length} documents total`);
  const sink = yield* DebugSink;
  if (sink.enabled) {
    yield* Effect.logInfo(`Debug mode: skipping database writes for ${documents.length} documents`);
    return { entriesCreated: 0, failures: [] } satisfies SyncSummary;
  }
  return yield* persistDocuments(documents);
});

export const readwiseIntegration: IntegrationDef = {
  integrationType: 'readwise',
  sync,
};
