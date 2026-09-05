import { readwiseDocuments } from '@hozo';
import { and, desc, eq, gte, isNotNull, isNull, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { Effect } from 'effect';
import { db } from '@/server/db/connections/postgres';
import { Database } from '../../runtime/db';
import { ApiRequestError } from '../../runtime/errors';
import { forEachCollect } from '../../runtime/run';
import { fetchReaderHighlights } from '../reader';
import { applyCleanup, type ReadwiseCleanupSnapshot } from './apply';
import { previewCleanup } from './preview';

const DOCUMENT_CONCURRENCY = 3;

export const formatNewHighlights = () =>
  Effect.gen(function* () {
    const database = yield* Database;
    const highlights = yield* database.use('readwise.unmappedHighlights', (client) =>
      client.query.readwiseDocuments.findMany({
        where: {
          category: 'highlight',
          recordId: { isNull: true },
          deletedAt: { isNull: true },
          parent: { location: 'archive', deletedAt: { isNull: true } },
        },
        columns: { id: true, parentId: true },
      })
    );
    const byParent = new Map<string, string[]>();
    for (const { id, parentId } of highlights) {
      if (!parentId) continue;
      const siblings = byParent.get(parentId);
      if (siblings) siblings.push(id);
      else byParent.set(parentId, [id]);
    }
    const result = yield* forEachCollect([...byParent], {
      concurrency: DOCUMENT_CONCURRENCY,
      label: ([parentId]) => parentId,
      worker: ([parentId, ids]) =>
        Effect.gen(function* () {
          const native = yield* Effect.tryPromise({
            try: (signal) => fetchReaderHighlights(parentId, signal),
            catch: (cause) =>
              new ApiRequestError({ resource: `Reader highlights ${parentId}`, cause }),
          });
          const nativeById = new Map(native.map((highlight) => [highlight.id, highlight.content]));
          for (const id of ids) {
            const content = nativeById.get(id);
            if (!content?.trim()) continue;
            yield* database.use(`readwise.formattedHighlight:${id}`, (client) =>
              client
                .update(readwiseDocuments)
                .set({ content, recordUpdatedAt: new Date() })
                .where(and(eq(readwiseDocuments.id, id), isNull(readwiseDocuments.recordId)))
            );
          }
          return { parentId, nativeById, ids };
        }),
    });
    yield* Effect.logInfo(
      `Fetched formatted highlights for ${result.successes.length} of ${byParent.size} Readwise documents`
    );
    return {
      readyHighlightIds: result.successes.flatMap((parent) => parent.ids),
      nativeByParent: new Map(
        result.successes.map((parent) => [parent.parentId, parent.nativeById])
      ),
      failures: result.failures,
    };
  });

export async function listCleanupParents(since?: Date, until?: Date) {
  const parent = alias(readwiseDocuments, 'parent');
  const rows = await db
    .selectDistinct({ recordId: parent.recordId, savedAt: parent.savedAt })
    .from(readwiseDocuments)
    .innerJoin(parent, eq(readwiseDocuments.parentId, parent.id))
    .where(
      and(
        eq(readwiseDocuments.category, 'highlight'),
        isNull(readwiseDocuments.deletedAt),
        isNotNull(readwiseDocuments.recordId),
        isNull(parent.deletedAt),
        isNotNull(parent.recordId),
        since ? gte(parent.savedAt, since) : undefined,
        until ? lt(parent.savedAt, until) : undefined
      )
    )
    .orderBy(desc(parent.savedAt));
  return rows.flatMap((row) => (row.recordId ? [row.recordId] : []));
}

export type CleanupResult = {
  documentId: string;
  recordId: number;
  recordIds: number[];
  snapshot: ReadwiseCleanupSnapshot | null;
};

type CleanupOptions = {
  onlyRecordIds?: ReadonlySet<number>;
  nativeByParent?: ReadonlyMap<string, ReadonlyMap<string, string>>;
  dryRun?: boolean;
  onApplied?: (result: CleanupResult) => Promise<void>;
};

export const cleanupDocuments = (
  parentRecordIds: number[],
  { onlyRecordIds, nativeByParent, dryRun = false, onApplied }: CleanupOptions = {}
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const parents = yield* database.use('readwise.cleanupParents', (client) =>
      client.query.readwiseDocuments.findMany({
        where: { recordId: { in: parentRecordIds }, deletedAt: { isNull: true } },
        columns: { id: true, recordId: true },
      })
    );
    const byRecord = new Map(
      parents.flatMap((parent) =>
        parent.recordId ? [[parent.recordId, { id: parent.id, recordId: parent.recordId }]] : []
      )
    );
    const result = yield* forEachCollect([...byRecord.values()], {
      concurrency: DOCUMENT_CONCURRENCY,
      label: (parent) => parent.id,
      worker: (parent) =>
        Effect.tryPromise({
          try: async (signal) => {
            const preview = await previewCleanup(parent.recordId, {
              nativeById: nativeByParent?.get(parent.id),
              signal,
            });
            const safe = preview.changes.filter(
              (change) =>
                change.changed &&
                !change.warnings.length &&
                !change.merged.length &&
                (!onlyRecordIds || onlyRecordIds.has(change.target.id))
            );
            const applied = safe.length && !dryRun ? await applyCleanup(safe) : null;
            const result: CleanupResult = {
              documentId: parent.id,
              recordId: parent.recordId,
              recordIds: safe.map((change) => change.target.id),
              snapshot: applied?.snapshot ?? null,
            };
            if (applied) await onApplied?.(result);
            return result;
          },
          catch: (cause) =>
            new ApiRequestError({ resource: `Readwise cleanup ${parent.id}`, cause }),
        }),
    });
    const count = result.successes.reduce((sum, item) => sum + item.recordIds.length, 0);
    yield* Effect.logInfo(
      `${dryRun ? 'Found' : 'Applied'} ${count} Readwise cleanup changes across ${parents.length} documents`
    );
    return { results: result.successes, failures: result.failures };
  });
