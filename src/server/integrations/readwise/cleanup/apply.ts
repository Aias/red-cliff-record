import {
  media,
  readwiseDocuments,
  records,
  type MediaInsert,
  type ReadwiseDocumentSelect,
  type RecordSelect,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/connections/postgres';
import { getMediaInsertData } from '@/server/lib/media';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import {
  mergeRecordsInTransaction,
  MergeSnapshotSchema,
  undoMergeInTransaction,
} from '@/server/services/merge-records';
import {
  hasReadwiseCleanupChanges,
  ReadwiseCleanupPreviewSchema,
  type ReadwiseCleanupPreview,
} from '@/shared/readwise-cleanup';

export const ReadwiseCleanupSnapshotSchema = z.object({
  merges: z.array(MergeSnapshotSchema),
  records: z.array(
    z.object({
      id: z.int().positive(),
      content: z.string().nullable(),
      recordUpdatedAt: z.date(),
    })
  ),
  mediaIds: z.array(z.int().positive()),
});

export type ReadwiseCleanupSnapshot = z.infer<typeof ReadwiseCleanupSnapshotSchema>;

export function prepareReadwiseCleanup(
  preview: ReadwiseCleanupPreview,
  selectedTargetIds: number[]
) {
  const validatedPreview = ReadwiseCleanupPreviewSchema.parse(preview);
  const selectedIds = new Set(selectedTargetIds);
  if (selectedIds.size !== selectedTargetIds.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A cleanup change was selected more than once.',
    });
  }
  const groupedIds = new Set<number>();
  const changes = validatedPreview.changes.map((change) => {
    const [targetId] = change.recordIds;
    if (
      new Set(change.recordIds).size !== change.recordIds.length ||
      change.recordIds.some((id) => groupedIds.has(id))
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cleanup changes contain duplicate or overlapping records.',
      });
    }
    change.recordIds.forEach((id) => groupedIds.add(id));
    return { ...change, targetId };
  });
  if (selectedTargetIds.some((id) => !changes.some((change) => change.targetId === id))) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A selected cleanup change is not in this preview.',
    });
  }
  const selected = changes.filter(
    (change) => selectedIds.has(change.targetId) && hasReadwiseCleanupChanges(change)
  );
  for (const change of selected) {
    const ids = new Set(change.recordIds);
    const beforeIds = new Set(change.before.map((record) => record.id));
    if (
      beforeIds.size !== change.before.length ||
      beforeIds.size !== ids.size ||
      change.before.some((record) => !ids.has(record.id))
    ) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A cleanup change does not include a complete record snapshot.',
      });
    }
    if (ids.has(validatedPreview.recordId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Highlight cleanup cannot replace the parent document.',
      });
    }
  }
  return { preview: validatedPreview, changes: selected };
}

export function validateReadwiseCleanupState(
  prepared: ReturnType<typeof prepareReadwiseCleanup>,
  currentRecords: ReadonlyArray<Pick<RecordSelect, 'id' | 'content' | 'recordUpdatedAt'>>,
  mappings: ReadonlyArray<
    Pick<ReadwiseDocumentSelect, 'id' | 'recordId' | 'parentId' | 'category' | 'deletedAt'>
  >
) {
  const { preview, changes } = prepared;
  const parent = mappings.find((mapping) => mapping.id === preview.documentId);
  if (
    !parent ||
    parent.recordId !== preview.recordId ||
    parent.deletedAt !== null ||
    parent.category === 'highlight' ||
    parent.category === 'note'
  ) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'The Readwise document has changed. Generate another cleanup preview.',
    });
  }
  const recordsById = new Map(currentRecords.map((record) => [record.id, record]));
  for (const change of changes) {
    for (const before of change.before) {
      const current = recordsById.get(before.id);
      if (
        !current ||
        current.content !== before.content ||
        current.recordUpdatedAt.getTime() !== new Date(before.updatedAt).getTime()
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Record ${before.id} changed after this preview. Generate another cleanup preview.`,
        });
      }
      const sources = mappings.filter((mapping) => mapping.recordId === before.id);
      if (
        sources.length === 0 ||
        sources.some(
          (source) =>
            source.deletedAt !== null ||
            source.category !== 'highlight' ||
            source.parentId !== preview.documentId
        )
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Record ${before.id} no longer belongs only to this Readwise document. Generate another cleanup preview.`,
        });
      }
    }
  }
}

async function describeImages(
  images: ReadwiseCleanupPreview['changes'][number]['images'],
  recordId: number
) {
  const unique = [...new Map(images.map((image) => [image.url, image])).values()];
  return Promise.all(
    unique.map(async ({ url, altText }) => {
      const fallback: MediaInsert = { url, recordId, type: 'image' };
      return { ...((await getMediaInsertData(url, { recordId })) ?? fallback), altText };
    })
  );
}

export async function applyReadwiseCleanup(
  preview: ReadwiseCleanupPreview,
  selectedTargetIds: number[]
) {
  const prepared = prepareReadwiseCleanup(preview, selectedTargetIds);
  const snapshot: ReadwiseCleanupSnapshot = { merges: [], records: [], mediaIds: [] };
  if (prepared.changes.length === 0) {
    return { updatedRecordIds: [], deletedRecordIds: [], snapshot };
  }
  const mediaByTarget = new Map<number, MediaInsert[]>();
  for (const change of prepared.changes) {
    mediaByTarget.set(change.targetId, await describeImages(change.images, change.targetId));
  }
  const result = await db.transaction(async (tx) => {
    const recordIds = prepared.changes.flatMap((change) => change.recordIds);
    const currentRecords = await tx
      .select({
        id: records.id,
        content: records.content,
        recordUpdatedAt: records.recordUpdatedAt,
      })
      .from(records)
      .where(inArray(records.id, recordIds))
      .orderBy(records.id)
      .for('update');
    const mappings = await tx
      .select({
        id: readwiseDocuments.id,
        recordId: readwiseDocuments.recordId,
        parentId: readwiseDocuments.parentId,
        category: readwiseDocuments.category,
        deletedAt: readwiseDocuments.deletedAt,
      })
      .from(readwiseDocuments)
      .where(
        or(
          eq(readwiseDocuments.id, prepared.preview.documentId),
          inArray(readwiseDocuments.recordId, recordIds)
        )
      )
      .orderBy(readwiseDocuments.id)
      .for('update');
    validateReadwiseCleanupState(prepared, currentRecords, mappings);
    snapshot.records = currentRecords.filter((record) =>
      prepared.changes.some((change) => change.targetId === record.id)
    );
    const updatedRecordIds: number[] = [];
    const deletedRecordIds: number[] = [];
    const touchedIds = new Set<number>();
    for (const change of prepared.changes) {
      for (const sourceId of change.recordIds.slice(1)) {
        const merged = await mergeRecordsInTransaction(tx, sourceId, change.targetId);
        merged.touchedIds.forEach((id) => touchedIds.add(id));
        deletedRecordIds.push(merged.deletedRecordId);
        snapshot.merges.push(merged.snapshot);
      }
      await tx
        .update(records)
        .set({ content: change.content, recordUpdatedAt: new Date() })
        .where(eq(records.id, change.targetId));
      const images = mediaByTarget.get(change.targetId) ?? [];
      if (images.length) {
        const inserted = await tx
          .insert(media)
          .values(images)
          .onConflictDoNothing()
          .returning({ id: media.id });
        snapshot.mediaIds.push(...inserted.map((row) => row.id));
      }
      updatedRecordIds.push(change.targetId);
      touchedIds.add(change.targetId);
    }
    const deletedIds = new Set(deletedRecordIds);
    const embeddingRecordIds = [...touchedIds].filter((id) => !deletedIds.has(id));
    await tx
      .update(records)
      .set({ textEmbedding: null, textEmbeddedAt: null })
      .where(inArray(records.id, embeddingRecordIds));
    return { updatedRecordIds, deletedRecordIds, embeddingRecordIds };
  });
  queueRecordEmbeddings(result.embeddingRecordIds);
  return {
    updatedRecordIds: result.updatedRecordIds,
    deletedRecordIds: result.deletedRecordIds,
    snapshot,
  };
}

export async function undoReadwiseCleanup(snapshot: ReadwiseCleanupSnapshot) {
  const touchedIds = await db.transaction(async (tx) => {
    const touched = new Set(snapshot.records.map((record) => record.id));
    for (const merge of snapshot.merges.toReversed()) {
      const restored = await undoMergeInTransaction(tx, merge);
      restored.touchedIds.forEach((id) => touched.add(id));
    }
    for (const record of snapshot.records) {
      await tx
        .update(records)
        .set({
          content: record.content,
          recordUpdatedAt: record.recordUpdatedAt,
          textEmbedding: null,
          textEmbeddedAt: null,
        })
        .where(eq(records.id, record.id));
    }
    if (snapshot.mediaIds.length) {
      await tx.delete(media).where(inArray(media.id, snapshot.mediaIds));
    }
    return [...touched];
  });
  queueRecordEmbeddings(touchedIds);
  return { restoredRecordIds: touchedIds };
}
