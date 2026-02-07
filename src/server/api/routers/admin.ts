import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createEmbedding } from '@/lib/server/create-embedding';
import { isAuthConfigured } from '@/server/lib/auth';
import {
  adminProcedure,
  createAdminRateLimitedProcedure,
  createTRPCRouter,
  publicProcedure,
} from '../init';

const embeddingProcedure = createAdminRateLimitedProcedure({ windowMs: 60_000, maxRequests: 200 });

export const adminRouter = createTRPCRouter({
  session: publicProcedure.query(({ ctx }) => ({
    isAdmin: ctx.isAdmin,
    authEnabled: isAuthConfigured(),
  })),
  createEmbedding: embeddingProcedure.input(z.string()).mutation(async ({ input }) => {
    try {
      const embedding = await createEmbedding(input);

      // Round to 8 decimal places to match PostgreSQL's float precision
      // TODO: This is a hack to match the precision of the PostgreSQL vector column. Using full precision can cause HTTP errors with request headers being too large. We should probably use a mutation rather than a query when working with embeddings so that if we end up using more dimensions or higher precision, we don't run into this issue.
      const normalizedEmbedding = embedding.map((value) => parseFloat(value.toFixed(8)));

      return normalizedEmbedding;
    } catch (error) {
      console.error(error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Create embedding: Failed to create embedding',
      });
    }
  }),
  testError: adminProcedure.mutation(() => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Test error',
    });
  }),
});
