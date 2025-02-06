import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { RecordInsertSchema, records } from '~/server/db/schema/records';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const recordsRouter = createTRPCRouter({
	get: publicProcedure.input(z.number().int().positive()).query(async ({ ctx: { db }, input }) => {
		const record = await db.query.records.findFirst({
			where: eq(records.id, input),
			with: {
				format: true,
				recordCreators: {
					with: {
						creator: true,
					},
				},
				recordCategories: {
					with: {
						category: true,
					},
				},
				recordMedia: {
					with: {
						media: true,
					},
				},
			},
		});
		if (!record) {
			throw new Error('Record not found');
		}
		return record;
	}),

	create: publicProcedure.input(RecordInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const [newRecord] = await db.insert(records).values(input).returning();
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		return newRecord;
	}),

	update: publicProcedure
		.input(RecordInsertSchema.partial().extend({ id: z.number().int().positive() }))
		.mutation(async ({ ctx: { db }, input }) => {
			const { id, ...updateData } = input;
			const [updatedRecord] = await db
				.update(records)
				.set({ ...updateData, recordUpdatedAt: new Date() })
				.where(eq(records.id, id))
				.returning();
			if (!updatedRecord) {
				throw new Error('Failed to update record');
			}
			return updatedRecord;
		}),

	delete: publicProcedure
		.input(z.number().int().positive())
		.mutation(async ({ ctx: { db }, input }) => {
			const [deletedRecord] = await db.delete(records).where(eq(records.id, input)).returning();
			return deletedRecord;
		}),

	search: publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
		return db.query.records.findMany({
			where: sql`(
        ${records.title} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
        ${records.content} <-> ${input} < ${SIMILARITY_THRESHOLD}
      )`,
			limit: 10,
			orderBy: [
				sql`LEAST(
          ${records.title} <-> ${input},
          ${records.content} <-> ${input}
        )`,
				desc(records.recordUpdatedAt),
			],
			with: {
				format: true,
				recordCreators: {
					with: {
						creator: true,
					},
				},
				recordCategories: {
					with: {
						category: true,
					},
				},
				recordMedia: {
					with: {
						media: true,
					},
				},
			},
		});
	}),
});
