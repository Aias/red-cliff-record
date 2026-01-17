import { TRPCError } from '@trpc/server';
import { embedRecordById } from '@/server/services/embed-records';
import { IdParamSchema } from '@/shared/types';
import { publicProcedure } from '../../init';

export const embed = publicProcedure
  .input(IdParamSchema)
  .mutation(async ({ ctx: { db }, input: { id } }) => {
    const result = await embedRecordById(id);

    if (!result.success) {
      throw new TRPCError({
        code: result.error === 'Record not found' ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
        message: `Embed record: ${result.error}`,
      });
    }

    // Fetch updated record to return timestamp
    const updatedRecord = await db.query.records.findFirst({
      where: { id },
      columns: { id: true, recordUpdatedAt: true },
    });

    if (!updatedRecord) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Embed record: Failed to fetch updated record ${id}`,
      });
    }

    return updatedRecord;
  });
