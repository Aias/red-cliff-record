import {
  type PredicateSlug,
  RecordSelectSchema,
  links,
  media,
  predicateSlugs,
  records,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { adminProcedure } from '../../init';
import { type IntegrationTableName, integrationTableMap } from './merge';

const IntegrationTableNameSchema = z.enum(
  Object.keys(integrationTableMap) as [IntegrationTableName, ...IntegrationTableName[]]
);

const SnapshotLinkSchema = z.object({
  id: z.number(),
  sourceId: z.number(),
  targetId: z.number(),
  predicate: z.enum(predicateSlugs as [PredicateSlug, ...PredicateSlug[]]),
  notes: z.string().nullable(),
  recordCreatedAt: z.date(),
  recordUpdatedAt: z.date(),
});

const MergeSnapshotSchema = z.object({
  sourceRecord: RecordSelectSchema,
  targetRecord: RecordSelectSchema,
  links: z.array(SnapshotLinkSchema),
  mediaAssignments: z.array(z.object({ id: z.number(), recordId: z.number().nullable() })),
  integrationAssignments: z.array(
    z.object({
      table: IntegrationTableNameSchema,
      id: z.union([z.string(), z.number()]),
      recordId: z.number(),
    })
  ),
});

export const undoMerge = adminProcedure
  .input(z.object({ snapshot: MergeSnapshotSchema }))
  .mutation(async ({ ctx: { db }, input: { snapshot } }) => {
    const { sourceRecord, targetRecord } = snapshot;

    // Verify the source record no longer exists (it was deleted by the merge)
    const existingSource = await db.query.records.findFirst({
      where: { id: sourceRecord.id },
      columns: { id: true },
    });
    if (existingSource) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Source record already exists — merge may have already been undone.',
      });
    }

    // Verify the target record still exists
    const existingTarget = await db.query.records.findFirst({
      where: { id: targetRecord.id },
      columns: { id: true },
    });
    if (!existingTarget) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Target record not found — cannot undo merge.',
      });
    }

    return db.transaction(async (tx) => {
      // 1. Restore target record to pre-merge field values
      const { id: _targetId, ...targetFields } = targetRecord;
      await tx
        .update(records)
        .set({ ...targetFields, textEmbedding: null })
        .where(eq(records.id, targetRecord.id));

      // 2. Re-insert source record with original ID
      const { textEmbedding: _embedding, ...sourceFields } = sourceRecord;
      const [restoredSource] = await tx
        .insert(records)
        .values({ ...sourceFields, textEmbedding: null })
        .returning();

      if (!restoredSource) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to restore source record.',
        });
      }

      // 3. Restore media assignments to original recordIds
      for (const assignment of snapshot.mediaAssignments) {
        await tx
          .update(media)
          .set({ recordId: assignment.recordId, recordUpdatedAt: new Date() })
          .where(eq(media.id, assignment.id));
      }

      // 4. Restore integration assignments
      for (const assignment of snapshot.integrationAssignments) {
        const table = integrationTableMap[assignment.table];
        await tx
          .update(table)
          .set({ recordId: assignment.recordId, recordUpdatedAt: new Date() })
          .where(eq(table.id, assignment.id));
      }

      // 5. Delete current links for both records, re-insert originals
      const bothIds = [sourceRecord.id, targetRecord.id];
      const currentLinks = await tx.query.links.findMany({
        where: {
          OR: [{ sourceId: { in: bothIds } }, { targetId: { in: bothIds } }],
        },
        columns: { id: true },
      });

      if (currentLinks.length > 0) {
        await tx.delete(links).where(
          inArray(
            links.id,
            currentLinks.map((l) => l.id)
          )
        );
      }

      if (snapshot.links.length > 0) {
        await tx.insert(links).values(
          snapshot.links.map((link) => ({
            sourceId: link.sourceId,
            targetId: link.targetId,
            predicate: link.predicate,
            notes: link.notes,
            recordCreatedAt: link.recordCreatedAt,
            recordUpdatedAt: link.recordUpdatedAt,
          }))
        );
      }

      // 6. Fetch restored records to return
      const [restoredSourceRecord, restoredTargetRecord] = await Promise.all([
        tx.query.records.findFirst({ where: { id: sourceRecord.id } }),
        tx.query.records.findFirst({ where: { id: targetRecord.id } }),
      ]);

      if (!restoredSourceRecord || !restoredTargetRecord) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch restored records.',
        });
      }

      return {
        sourceRecord: restoredSourceRecord,
        targetRecord: restoredTargetRecord,
      };
    });
  });
