import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createEmbedding } from '@/lib/server/create-embedding';
import { createTRPCRouter, publicProcedure } from '../init';

export const adminRouter = createTRPCRouter({
	createEmbedding: publicProcedure.input(z.string()).mutation(async ({ input }) => {
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
	testError: publicProcedure.mutation(() => {
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Test error',
		});
	}),
});
