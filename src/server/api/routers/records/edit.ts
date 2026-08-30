import { records } from '@hozo';
import { TRPCError } from '@trpc/server';
import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import { EMBEDDING_RECORD_FIELDS } from '@/shared/lib/embedding';
import { BulkUpdateDataSchema, IdSchema, RecordUpsertSchema, type DbId } from '@/shared/types/api';
import type { RecordGet } from '@/shared/types/domain';
import { publicProcedure } from '../../init';

type CuratedAt = Date | null | undefined;

const curatedAtUpdate = (isCurated: boolean | undefined, recordCuratedAt: CuratedAt) =>
  recordCuratedAt !== undefined || isCurated === undefined
    ? {}
    : { recordCuratedAt: isCurated ? sql`coalesce(${records.recordCuratedAt}, now())` : null };

const curatedAtInsert = (isCurated: boolean | undefined, recordCuratedAt: CuratedAt) =>
  recordCuratedAt !== undefined || isCurated === undefined
    ? {}
    : { recordCuratedAt: isCurated ? new Date() : null };

export const upsert = publicProcedure
  .input(RecordUpsertSchema)
  .mutation(async ({ ctx: { db, loaders }, input }): Promise<RecordGet> => {
    const { isCurated, ...fields } = input;
    const curation = curatedAtUpdate(isCurated, fields.recordCuratedAt);
    const updateFields = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    const embeddingFields = new Set<string>(EMBEDDING_RECORD_FIELDS);
    const affectsEmbedding = Object.keys(updateFields).some((k) => embeddingFields.has(k));

    const [result] = await db
      .insert(records)
      .values({ ...fields, ...curatedAtInsert(isCurated, fields.recordCuratedAt) })
      .onConflictDoUpdate({
        target: records.id,
        set: {
          ...updateFields,
          ...curation,
          recordUpdatedAt: new Date(),
          ...(affectsEmbedding ? { textEmbedding: null, textEmbeddedAt: null } : {}),
        },
      })
      .returning({
        id: records.id,
      });

    if (!result) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Record upsert failed. Input data:\n\n${JSON.stringify(input, null, 2)}`,
      });
    }

    const record = await loaders.record.load(result.id);
    if (record instanceof Error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Record upsert failed. Input data:\n\n${JSON.stringify(input, null, 2)}`,
      });
    }

    if (input.id === undefined || affectsEmbedding) {
      queueRecordEmbeddings([result.id]);
    }

    return record;
  });

export const bulkUpdate = publicProcedure
  .input(
    z.object({
      ids: z.array(IdSchema).min(1),
      data: BulkUpdateDataSchema,
    })
  )
  .mutation(async ({ ctx: { db }, input: { ids, data } }): Promise<DbId[]> => {
    const { isCurated, ...fields } = data;
    const definedFields = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );
    const updateData = { ...definedFields, ...curatedAtUpdate(isCurated, fields.recordCuratedAt) };

    if (Object.keys(updateData).length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No fields provided to update',
      });
    }

    const embeddingFields = new Set<string>(EMBEDDING_RECORD_FIELDS);
    const affectsEmbedding = Object.keys(definedFields).some((k) => embeddingFields.has(k));

    const updated = await db
      .update(records)
      .set({
        ...updateData,
        recordUpdatedAt: new Date(),
        ...(affectsEmbedding ? { textEmbedding: null, textEmbeddedAt: null } : {}),
      })
      .where(inArray(records.id, ids))
      .returning({ id: records.id });

    if (affectsEmbedding) {
      queueRecordEmbeddings(updated.map((r) => r.id));
    }

    if (updated.length !== ids.length) {
      const updatedIds = new Set(updated.map((r) => r.id));
      const missing = ids.filter((id) => !updatedIds.has(id));
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Records not found: ${missing.join(', ')}`,
      });
    }

    return updated.map((r) => r.id);
  });
