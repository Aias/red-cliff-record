import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { recordCategories, recordCreators, records } from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';

export const relationsRouter = createTRPCRouter({
	getRecordsForCategory: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const records = await db.query.recordCategories.findMany({
				where: eq(recordCategories.categoryId, input),
				with: {
					record: true,
				},
			});
			return records;
		}),

	getRecordsByCreator: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const records = await db.query.recordCreators.findMany({
				where: eq(recordCreators.entityId, input),
				with: {
					record: true,
				},
			});
			return records;
		}),

	getRecordsWithFormat: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const data = await db.query.records.findMany({
				where: eq(records.formatId, input),
			});
			return data;
		}),
});
