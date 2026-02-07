import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure } from '../init';

export const adminRouter = createTRPCRouter({
  testError: publicProcedure.mutation(() => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Test error',
    });
  }),
});
