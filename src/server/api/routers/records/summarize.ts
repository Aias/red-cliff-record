import { TRPCError } from '@trpc/server';
import { summarizeDocument } from '@/server/integrations/readwise/summarize-document';
import { IdParamSchema } from '@/shared/types/api';
import { publicProcedure } from '../../init';

export const summarize = publicProcedure
  .input(IdParamSchema)
  .mutation(async ({ input: { id } }) => {
    const summary = await summarizeDocument(id);
    if (summary === null) {
      throw new TRPCError({
        code: 'UNPROCESSABLE_CONTENT',
        message: `Summarize: record ${id} has no Reader text to summarize`,
      });
    }
    return summary;
  });
