import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod/v4';
import { publicProcedure } from '../../init';
import { RecordInsertSchema, records } from '@/db/schema';
import { IdSchema, type DbId } from '@/shared/types';
import type { RecordGet } from '@/shared/types';

export const upsert = publicProcedure
	.input(RecordInsertSchema)
	.mutation(async ({ ctx: { db, loaders }, input }): Promise<RecordGet> => {
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

		return record;
	});

export const markAsCurated = publicProcedure
	.input(z.object({ ids: z.array(IdSchema) }))
	.mutation(async ({ ctx: { db }, input }): Promise<DbId[]> => {
		const updatedRecords = await db
			.update(records)
			.set({ isCurated: true, recordUpdatedAt: new Date() })
			.where(inArray(records.id, input.ids))
			.returning({
				id: records.id,
			});

		if (updatedRecords.length !== input.ids.length) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to update records. Input data:\n\n${JSON.stringify(input, null, 2)}`,
			});
		}

		return updatedRecords.map((r) => r.id);
	});
