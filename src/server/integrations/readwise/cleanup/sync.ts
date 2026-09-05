import { readwiseDocuments } from '@hozo';
import { and, eq, isNull } from 'drizzle-orm';
import { Effect } from 'effect';
import { Database } from '../../runtime/db';
import { ApiRequestError } from '../../runtime/errors';
import { forEachCollect } from '../../runtime/run';
import { fetchReaderHighlights } from '../reader';
import { applyCleanup } from './apply';
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

type CleanupOptions = {
  onlyRecordIds?: ReadonlySet<number>;
  nativeByParent?: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export const cleanupDocuments = (
  parentRecordIds: number[],
  { onlyRecordIds, nativeByParent }: CleanupOptions = {}
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const parents = yield* database.use('readwise.cleanupParents', (client) =>
      client.query.readwiseDocuments.findMany({
        where: { recordId: { in: parentRecordIds }, deletedAt: { isNull: true } },
        columns: { id: true, recordId: true },
      })
    );
    const result = yield* forEachCollect(
      parents.flatMap((parent) =>
        parent.recordId ? [{ id: parent.id, recordId: parent.recordId }] : []
      ),
      {
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
              if (safe.length) await applyCleanup(safe);
              return safe.length;
            },
            catch: (cause) =>
              new ApiRequestError({ resource: `Readwise cleanup ${parent.id}`, cause }),
          }),
      }
    );
    const applied = result.successes.reduce((sum, count) => sum + count, 0);
    yield* Effect.logInfo(
      `Applied Readwise cleanup to ${applied} records across ${parents.length} documents`
    );
    return result.failures;
  });
