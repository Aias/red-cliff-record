import { readwiseDocuments } from '@hozo';
import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import type { ReadwiseCleanupPreview } from '@/shared/readwise-cleanup';
import { fetchDocumentHtml, fetchReaderHighlights } from '../reader';
import { addEditorialSuggestions } from './editorial';
import { proposeCleanup } from './propose';
import { parseSource } from './source';

type PreviewOptions = {
  editorial?: boolean;
  merge?: number[];
  nativeById?: ReadonlyMap<string, string>;
  signal?: AbortSignal;
};

export async function previewCleanup(
  recordId: number,
  { editorial = false, merge, nativeById, signal }: PreviewOptions = {}
): Promise<ReadwiseCleanupPreview> {
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
  const rows = await db.query.readwiseDocuments.findMany({
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
  const issues = rows
    .filter((row) => row.recordId === parentRecordId)
    .map((row) => `Highlight ${row.id} is merged into the document record and was left unchanged.`);
  const failed =
    <T>(fallback: T) =>
    (error: unknown) => {
      if (signal?.aborted) throw error;
      issues.push(error instanceof Error ? error.message : String(error));
      return fallback;
    };
  const highlights = rows.flatMap(({ record, ...row }) =>
    record && record.id !== parentRecordId && (!merge || merge.includes(record.id))
      ? [{ ...row, record }]
      : []
  );
  const native =
    nativeById ??
    new Map(
      (await fetchReaderHighlights(parent.id, signal).catch(failed([]))).map((highlight) => [
        highlight.id,
        highlight.content,
      ])
    );
  let html = parent.htmlContent;
  if (!html) {
    html = await fetchDocumentHtml(parent.id, signal).catch(failed(null));
    if (html) {
      await db
        .update(readwiseDocuments)
        .set({ htmlContent: html })
        .where(eq(readwiseDocuments.id, parent.id));
    }
  }
  const source = html ? parseSource(html, parent.sourceUrl) : null;
  const { changes, mergeable } = proposeCleanup(
    highlights,
    native,
    source,
    parent.sourceUrl,
    merge
  );
  if (editorial) issues.push(...(await addEditorialSuggestions(changes, signal).catch(failed([]))));
  return {
    documentId: parent.id,
    recordId: parentRecordId,
    title: parent.title,
    sourceUrl: parent.sourceUrl,
    sourceAvailable: source !== null,
    changes,
    mergeable,
    issues,
  };
}
