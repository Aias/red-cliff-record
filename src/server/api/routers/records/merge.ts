import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { queueRecordEmbeddings } from '@/server/services/embed-records';
import { mergeRecordsInTransaction } from '@/server/services/merge-records';
import { publicProcedure } from '../../init';

export const merge = publicProcedure
  .input(z.object({ sourceId: z.number().int().positive(), targetId: z.number().int().positive() }))
  .mutation(async ({ ctx: { db }, input: { sourceId, targetId } }) => {
    try {
      const result = await db.transaction((tx) =>
        mergeRecordsInTransaction(tx, sourceId, targetId)
      );
      queueRecordEmbeddings(result.touchedIds);
      return result;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to merge records: ${error instanceof Error ? error.message : 'Unknown error'}`,
        cause: error,
      });
    }
  });
