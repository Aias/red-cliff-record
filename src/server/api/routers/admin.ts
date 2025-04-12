import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createEmbedding } from '@/server/services/ai/create-embedding';
import { createTRPCRouter, publicProcedure } from '../init';

export const adminRouter = createTRPCRouter({
	createEmbedding: publicProcedure.input(z.string()).mutation(async ({ input }) => {
		try {
			const embedding = await createEmbedding(input);
			return embedding;
		} catch (error) {
			console.error(error);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Failed to create embedding',
			});
		}
	}),
});
