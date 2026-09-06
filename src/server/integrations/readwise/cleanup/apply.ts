import { media, records, type MediaInsert } from '@hozo';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/connections/postgres';
import { getMediaInsertData } from '@/server/lib/media';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import {
  mergeRecordsInTransaction,
  MergeSnapshotSchema,
  undoMergeInTransaction,
} from '@/server/services/merge-records';
import type { ReadwiseCleanupChange } from '@/shared/readwise-cleanup';

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

const describeImages = (change: ReadwiseCleanupChange) =>
  Promise.all(
    change.images.map(async ({ url, altText }): Promise<MediaInsert> => {
      const recordId = change.target.id;
      const described = await getMediaInsertData(url, { recordId });
      return { ...(described ?? { url, recordId, type: 'image' }), altText };
    })
  );

export async function applyCleanup(changes: ReadwiseCleanupChange[]) {
  const selected = changes.filter((change) => change.changed);
  const snapshot: ReadwiseCleanupSnapshot = { merges: [], records: [], mediaIds: [] };
  if (!selected.length) return { updatedRecordIds: [], deletedRecordIds: [], snapshot };
  const mediaByTarget = new Map<number, MediaInsert[]>();
  for (const change of selected) {
    mediaByTarget.set(change.target.id, await describeImages(change));
  }
  const expected = selected.flatMap((change) => [change.target, ...change.merged]);
  const result = await db.transaction(async (tx) => {
    const current = await tx
      .select({
        id: records.id,
        content: records.content,
        recordUpdatedAt: records.recordUpdatedAt,
      })
      .from(records)
      .where(
        inArray(
          records.id,
          expected.map((record) => record.id)
        )
      )
      .orderBy(records.id)
      .for('update');
    const byId = new Map(current.map((row) => [row.id, row]));
    for (const record of expected) {
      const row = byId.get(record.id);
      if (
        !row ||
        row.content !== record.content ||
        row.recordUpdatedAt.getTime() !== new Date(record.updatedAt).getTime()
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Record ${record.id} changed after this preview. Generate another preview.`,
        });
      }
    }
    snapshot.records = current.filter((row) =>
      selected.some((change) => change.target.id === row.id)
    );
    const touched = new Set<number>();
    const deletedRecordIds: number[] = [];
    for (const change of selected) {
      for (const source of change.merged) {
        const merged = await mergeRecordsInTransaction(tx, source.id, change.target.id);
        for (const id of merged.touchedIds) touched.add(id);
        deletedRecordIds.push(source.id);
        snapshot.merges.push(merged.snapshot);
      }
      await tx
        .update(records)
        .set({ content: change.content, recordUpdatedAt: new Date() })
        .where(eq(records.id, change.target.id));
      const images = mediaByTarget.get(change.target.id) ?? [];
      if (images.length) {
        const inserted = await tx
          .insert(media)
          .values(images)
          .onConflictDoNothing()
          .returning({ id: media.id });
        snapshot.mediaIds.push(...inserted.map((row) => row.id));
      }
      touched.add(change.target.id);
    }
    const embeddingRecordIds = [...touched].filter((id) => !deletedRecordIds.includes(id));
    await tx
      .update(records)
      .set({ textEmbedding: null, textEmbeddedAt: null })
      .where(inArray(records.id, embeddingRecordIds));
    return { deletedRecordIds, embeddingRecordIds };
  });
  queueRecordEmbeddings(result.embeddingRecordIds);
  return {
    updatedRecordIds: selected.map((change) => change.target.id),
    deletedRecordIds: result.deletedRecordIds,
    snapshot,
  };
}

export async function undoCleanup(snapshot: ReadwiseCleanupSnapshot) {
  const restoredRecordIds = await db.transaction(async (tx) => {
    const touched = new Set(snapshot.records.map((record) => record.id));
    for (const merge of snapshot.merges.toReversed()) {
      for (const id of (await undoMergeInTransaction(tx, merge)).touchedIds) touched.add(id);
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
  queueRecordEmbeddings(restoredRecordIds);
  return { restoredRecordIds };
}
