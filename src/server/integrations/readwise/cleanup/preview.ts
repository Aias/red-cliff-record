import { TRPCError } from '@trpc/server';
import { db } from '@/server/db/connections/postgres';
import { hasReadwiseCleanupChanges } from '@/shared/readwise-cleanup';
import { fetchReaderDocument, fetchReaderHighlights } from '../reader';
import { addEditorialSuggestions } from './editorial';
import { proposeReadwiseCleanup } from './proposals';
import { renderMarkdown } from './source';

export async function previewReadwiseCleanup(
  recordId: number,
  {
    editorial = false,
    combineRecordIds = [],
    nativeById,
    signal,
  }: {
    editorial?: boolean;
    combineRecordIds?: number[];
    nativeById?: Map<string, string>;
    signal?: AbortSignal;
  } = {}
) {
  const mapped = await db.query.readwiseDocuments.findFirst({
    where: { recordId, deletedAt: { isNull: true } },
    with: { parent: true },
  });
  const parent = mapped?.category === 'highlight' ? mapped.parent : mapped;
  if (!parent?.recordId) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'This record has no imported Readwise document.',
    });
  }
  const parentRecordId = parent.recordId;
  const mappedHighlights = await db.query.readwiseDocuments.findMany({
    where: { parentId: parent.id, category: 'highlight', deletedAt: { isNull: true } },
    columns: { id: true, recordId: true, content: true },
    with: {
      record: {
        columns: {
          id: true,
          content: true,
          contentCreatedAt: true,
          recordCreatedAt: true,
          recordUpdatedAt: true,
        },
        with: { media: { columns: { url: true } } },
      },
    },
  });
  const issues = mappedHighlights
    .filter((highlight) => highlight.recordId === parentRecordId)
    .map(
      (highlight) =>
        `Highlight ${highlight.id} is merged into the document record and was left unchanged.`
    );
  const highlights = mappedHighlights.filter((highlight) => highlight.recordId !== parentRecordId);
  const native =
    nativeById ??
    new Map(
      (
        await fetchReaderHighlights(parent.id, signal).catch((error: unknown) => {
          if (signal?.aborted) throw error;
          issues.push(
            error instanceof Error ? error.message : 'Formatted highlights are unavailable.'
          );
          return [];
        })
      ).map((highlight) => [highlight.id, highlight.content])
    );
  let html = parent.htmlContent;
  if (!html) {
    const document = await fetchReaderDocument(parent.id, signal).catch((error: unknown) => {
      if (signal?.aborted) throw error;
      issues.push(error instanceof Error ? error.message : 'The source document is unavailable.');
      return null;
    });
    if (document?.content) html = renderMarkdown(document.content);
  }
  const {
    changes,
    combinablePairs,
    issues: sourceIssues,
    sourceAvailable,
  } = proposeReadwiseCleanup(
    combineRecordIds.length
      ? highlights.filter(
          (highlight) =>
            highlight.recordId !== null && combineRecordIds.includes(highlight.recordId)
        )
      : highlights,
    native,
    html,
    parent.sourceUrl,
    editorial,
    combineRecordIds
  );
  issues.push(...sourceIssues);
  const unchangedRecordIds: number[] = [];

  if (editorial) {
    issues.push(
      ...(await addEditorialSuggestions(changes, signal).catch((error: unknown) => {
        if (signal?.aborted) throw error;
        return [error instanceof Error ? error.message : 'The spelling and grammar check failed.'];
      }))
    );
  }
  const proposals = changes.filter((change) => {
    if (!hasReadwiseCleanupChanges(change)) {
      unchangedRecordIds.push(...change.recordIds);
      return combinablePairs.some((pair) => pair.some((id) => change.recordIds.includes(id)));
    }
    return true;
  });

  return {
    documentId: parent.id,
    recordId: parent.recordId,
    title: parent.title,
    sourceUrl: parent.sourceUrl,
    sourceAvailable,
    changes: proposals,
    combinablePairs,
    unchangedRecordIds,
    issues,
  };
}
