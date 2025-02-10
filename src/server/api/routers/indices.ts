import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { indices, IndicesInsertSchema } from '~/server/db/schema/indices';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const indicesRouter = createTRPCRouter({
	get: publicProcedure.input(z.number().int().positive()).query(async ({ ctx: { db }, input }) => {
		const entry = await db.query.indices.findFirst({
			with: {
				recordCategories: {
					with: {
						record: true,
					},
				},
				recordCreators: {
					with: {
						record: true,
					},
				},
				recordFormats: true,
			},
			where: eq(indices.id, input),
		});
		if (!entry) {
			throw new Error('Index entry not found');
		}
		return entry;
	}),

	getSources: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const entry = await db.query.indices.findFirst({
				with: {
					airtableCreators: true,
					airtableFormats: true,
					airtableSpaces: true,
					githubUsers: true,
					raindropCollections: true,
					raindropTags: true,
					readwiseAuthors: true,
					readwiseTags: true,
					twitterUsers: true,
				},
				where: eq(indices.id, input),
			});
			if (!entry) {
				throw new Error('Index entry not found');
			}
			return entry;
		}),

	upsert: publicProcedure.input(IndicesInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const { id, ...values } = input;
		const [entry] = await db
			.insert(indices)
			.values(input)
			.onConflictDoUpdate({
				target: indices.id,
				where: id ? eq(indices.id, id) : undefined,
				set: { ...values, recordUpdatedAt: new Date() },
			})
			.returning();

		if (!entry) {
			throw new Error('Failed to upsert index entry');
		}
		return entry;
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
				desc(indices.recordUpdatedAt),
			],
		});
		return matches;
	}),
});
