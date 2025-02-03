import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { indices, IndicesInsertSchema } from '~/server/db/schema/main';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const indicesRouter = createTRPCRouter({
	get: publicProcedure.input(z.number().int().positive()).query(async ({ ctx: { db }, input }) => {
		const entry = await db.query.indices.findFirst({
			with: {
				airtableCreators: true,
				airtableSpaces: true,
				githubUsers: true,
				twitterUsers: true,
			},
			where: eq(indices.id, input),
		});
		if (!entry) {
			throw new Error('Index entry not found');
		}
		return entry;
	}),

	create: publicProcedure.input(IndicesInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const [newEntry] = await db.insert(indices).values(input).returning();
		if (!newEntry) {
			throw new Error('Failed to create index entry');
		}
		return newEntry;
	}),

	update: publicProcedure
		.input(IndicesInsertSchema.partial().extend({ id: z.number().int().positive() }))
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

	delete: publicProcedure
		.input(z.number().int().positive())
		.mutation(async ({ ctx: { db }, input }) => {
			const [deletedEntry] = await db.delete(indices).where(eq(indices.id, input)).returning();
			return deletedEntry;
		}),

	search: publicProcedure.input(z.string()).query(async ({ ctx: { db }, input }) => {
		const matches = await db.query.indices.findMany({
			where: sql`(
          ${indices.name} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
          ${indices.shortName} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
          ${indices.notes} <-> ${input} < ${SIMILARITY_THRESHOLD}
        )`,
			limit: 10,
			orderBy: [
				sql`LEAST(
            ${indices.name} <-> ${input},
            ${indices.shortName} <-> ${input},
            ${indices.notes} <-> ${input}
          )`,
				desc(indices.updatedAt),
			],
		});
		return matches;
	}),
});
