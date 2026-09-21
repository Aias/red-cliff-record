import { TRPCError } from '@trpc/server';
import { suggestRecordFormats } from '@/server/services/classify-record-format';
import { IdParamSchema } from '@/shared/types/api';
import { publicProcedure } from '../../init';

export const suggestFormats = publicProcedure
  .input(IdParamSchema)
  .query(async ({ input: { id } }) => {
    const suggestions = await suggestRecordFormats(id);
    if (suggestions === null) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Suggest formats: record ${id} not found`,
      });
    }
    return suggestions;
  });
