import { desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { indices, IndicesInsertSchema, IndicesUpdateSchema } from '~/server/db/schema/main';
import { createTRPCRouter, publicProcedure } from '../init';

export const indicesRouter = createTRPCRouter({
	createIndexEntry: publicProcedure
		.input(IndicesInsertSchema)
		.mutation(async ({ ctx: { db }, input }) => {
			const [newEntry] = await db.insert(indices).values(input).returning();
			if (!newEntry) {
				throw new Error('Failed to create index entry');
			}
			return newEntry;
		}),

	updateIndexEntry: publicProcedure
		.input(IndicesUpdateSchema.extend({ id: z.number().int().positive() }))
		.mutation(async ({ ctx: { db }, input }) => {
			const [updatedEntry] = await db
				.update(indices)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(indices.id, input.id))
				.returning();
			if (!updatedEntry) {
				throw new Error('Failed to update index entry');
			}
			return updatedEntry;
		}),

	getIndexEntry: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const entry = await db.query.indices.findFirst({ where: eq(indices.id, input) });
			if (!entry) {
				throw new Error('Index entry not found');
			}
			return entry;
		}),

	findRelatedIndices: publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
		return db.query.indices.findMany({
			where: or(
				ilike(indices.name, `%${input}%`),
				ilike(indices.shortName, `%${input}%`),
				ilike(indices.notes, `%${input}%`)
			),
			limit: 10,
			orderBy: desc(indices.updatedAt),
		});
	}),
});
