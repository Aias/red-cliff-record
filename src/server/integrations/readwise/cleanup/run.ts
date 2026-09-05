import { readwiseDocuments } from '@hozo';
import { and, eq, isNull } from 'drizzle-orm';
import { Config, Effect } from 'effect';
import { hasReadwiseCleanupChanges } from '@/shared/readwise-cleanup';
import { Database } from '../../runtime/db';
import { ApiRequestError } from '../../runtime/errors';
import { forEachCollect } from '../../runtime/run';
import { fetchReaderHighlights } from '../reader';
import { applyReadwiseCleanup } from './apply';
import { previewReadwiseCleanup } from './preview';

const DOCUMENT_CONCURRENCY = 3;
const FORMATTING_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const restoreNativeReadwiseHighlights = () =>
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
        columns: { id: true, parentId: true, recordCreatedAt: true },
      })
    );
    const byParent = new Map<string, typeof highlights>();
    for (const highlight of highlights) {
      if (!highlight.parentId) continue;
      const siblings = byParent.get(highlight.parentId) ?? [];
      siblings.push(highlight);
      byParent.set(highlight.parentId, siblings);
    }

    const result = yield* forEachCollect([...byParent], {
      concurrency: DOCUMENT_CONCURRENCY,
      label: ([parentId]) => parentId,
      worker: ([parentId, siblings]) =>
        Effect.gen(function* () {
          const native = yield* Effect.tryPromise({
            try: (signal) => fetchReaderHighlights(parentId, signal),
            catch: (cause) =>
              new ApiRequestError({ resource: `Reader highlights ${parentId}`, cause }),
          });
          const nativeById = new Map(native.map((highlight) => [highlight.id, highlight.content]));
          const restored = yield* forEachCollect(siblings, {
            concurrency: 1,
            label: (highlight) => highlight.id,
            worker: (highlight) =>
              Effect.gen(function* () {
                const content = nativeById.get(highlight.id);
                if (!content?.trim()) {
                  if (
                    Date.now() - highlight.recordCreatedAt.getTime() <
                    FORMATTING_RETRY_WINDOW_MS
                  ) {
                    return yield* Effect.fail(
                      new ApiRequestError({
                        resource: `Reader highlight ${highlight.id}`,
                        cause: 'The formatted highlight is unavailable.',
                      })
                    );
                  }
                  yield* Effect.logWarning(
                    `Promoting Readwise highlight ${highlight.id} from its plain text because no formatted version arrived within the retry window`
                  );
                  return [{ id: highlight.id }];
                }
                return yield* database.use(
                  `readwise.formattedHighlight:${highlight.id}`,
                  (client) =>
                    client
                      .update(readwiseDocuments)
                      .set({ content, recordUpdatedAt: new Date() })
                      .where(
                        and(
                          eq(readwiseDocuments.id, highlight.id),
                          isNull(readwiseDocuments.recordId)
                        )
                      )
                      .returning({ id: readwiseDocuments.id })
                );
              }),
          });
          return { parentId, nativeById, restored };
        }),
    });
    const restored = result.successes.flatMap((parent) => parent.restored.successes.flat());
    yield* Effect.logInfo(
      `Restored native formatting for ${restored.length} new Readwise highlights`
    );
    return {
      failures: [
        ...result.failures,
        ...result.successes.flatMap((parent) => parent.restored.failures),
      ],
      restoredHighlightIds: restored.map((highlight) => highlight.id),
      nativeByParent: new Map(
        result.successes.map((parent) => [parent.parentId, parent.nativeById])
      ),
    };
  });

export const runNewReadwiseCleanup = (
  recordIds: number[],
  nativeByParent: ReadonlyMap<string, Map<string, string>>
) =>
  Effect.gen(function* () {
    const mode = yield* Config.literals(['preview', 'automatic'], 'READWISE_CLEANUP_MODE').pipe(
      Config.withDefault('preview')
    );
    const database = yield* Database;
    const highlights = yield* database.use('readwise.newHighlightParents', (client) =>
      client.query.readwiseDocuments.findMany({
        where: {
          recordId: { in: recordIds },
          category: 'highlight',
          deletedAt: { isNull: true },
          parent: { location: 'archive', deletedAt: { isNull: true } },
        },
        columns: { id: true },
        with: { parent: { columns: { id: true, recordId: true } } },
      })
    );
    const parents = new Map(
      highlights.flatMap((highlight) =>
        highlight.parent?.recordId ? [[highlight.parent.recordId, highlight.parent.id]] : []
      )
    );
    const newRecordIds = new Set(recordIds);
    const result = yield* forEachCollect([...parents], {
      concurrency: DOCUMENT_CONCURRENCY,
      label: ([parentId]) => String(parentId),
      worker: ([parentId, documentId]) =>
        Effect.gen(function* () {
          const preview = yield* Effect.tryPromise({
            try: (signal) =>
              previewReadwiseCleanup(parentId, {
                nativeById: nativeByParent.get(documentId),
                signal,
              }),
            catch: (cause) =>
              new ApiRequestError({ resource: `Readwise cleanup ${parentId}`, cause }),
          });
          const relevantChanges = preview.changes.filter(
            (change) =>
              hasReadwiseCleanupChanges(change) &&
              change.recordIds.some((id) => newRecordIds.has(id))
          );
          const newChanges = relevantChanges.filter((change) =>
            change.recordIds.every((id) => newRecordIds.has(id))
          );
          const safeTargetIds = newChanges
            .filter((change) => change.warnings.length === 0)
            .flatMap((change) => change.recordIds.slice(0, 1));
          const reviewWarnings = relevantChanges.reduce(
            (count, change) => count + change.warnings.length,
            0
          );
          yield* Effect.logInfo(
            `Readwise cleanup ${parentId}: ${newChanges.length} new-record changes, ${safeTargetIds.length} eligible for automatic cleanup, ${relevantChanges.length - newChanges.length} involve existing records, ${reviewWarnings} review warnings, ${preview.issues.length} source issues (${mode})`
          );
          for (const issue of preview.issues) yield* Effect.logWarning(issue);
          if (mode === 'automatic' && safeTargetIds.length) {
            yield* Effect.tryPromise({
              try: () => applyReadwiseCleanup(preview, safeTargetIds),
              catch: (cause) =>
                new ApiRequestError({ resource: `Apply Readwise cleanup ${parentId}`, cause }),
            });
            yield* Effect.logInfo(
              `Applied ${safeTargetIds.length} Readwise cleanup changes for ${parentId}`
            );
          }
        }),
    });
    return result.failures;
  });
