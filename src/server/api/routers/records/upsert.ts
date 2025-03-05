import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../init';
import { RecordInsertSchema, records } from '@/db/schema';

export const upsert = publicProcedure
	.input(RecordInsertSchema)
	.mutation(async ({ ctx: { db }, input }) => {
		const [result] = await db
			.insert(records)
			.values(input)
			.onConflictDoUpdate({
				target: records.id,
				set: {
					...input,
					recordUpdatedAt: new Date(),
					textEmbedding: null, // Changes require recalculating the embedding.
				},
			})
			.returning();

		if (!result) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Record upsert failed. Input data:\n\n${JSON.stringify(input, null, 2)}`,
			});
		}

		return result;
	});
