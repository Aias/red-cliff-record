import { createTRPCRouter, publicProcedure } from '../init';
import { eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { arcBrowsingHistory, arcBrowsingHistoryOmitList } from '~/server/db/schema/integrations';

export const browserHistoryRouter = createTRPCRouter({
	getByDate: publicProcedure
		.input(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
		.query(({ ctx: { db }, input: date }) => {
			const tzOffset = new Date().getTimezoneOffset();
			const adjustedOffset = -tzOffset;

			return db
				.select({
					hostname: arcBrowsingHistory.hostname,
					url: arcBrowsingHistory.url,
					pageTitle: arcBrowsingHistory.pageTitle,
					totalDuration: sql<number>`sum(${arcBrowsingHistory.viewDuration})`,
					visitCount: sql<number>`count(*)`,
					firstVisit: sql<string>`min(${arcBrowsingHistory.viewTime})`,
					lastVisit: sql<string>`max(${arcBrowsingHistory.viewTime})`,
				})
				.from(arcBrowsingHistory)
				.where(
					sql`DATE(${arcBrowsingHistory.viewTime} + INTERVAL ${sql.raw(`'${adjustedOffset} MINUTES'`)}) = to_date(${date}, 'YYYY-MM-DD') AND NOT EXISTS (
					SELECT 1 FROM ${arcBrowsingHistoryOmitList}
					WHERE ${arcBrowsingHistory.url} LIKE ${arcBrowsingHistoryOmitList.pattern}
				)`
				)
				.groupBy(arcBrowsingHistory.hostname, arcBrowsingHistory.url, arcBrowsingHistory.pageTitle)
				.orderBy(sql`min(${arcBrowsingHistory.viewTime})`);
		}),
});

export const omitListRouter = createTRPCRouter({
	getList: publicProcedure.query(({ ctx: { db } }) => {
		return db
			.select({
				pattern: arcBrowsingHistoryOmitList.pattern,
				createdAt: arcBrowsingHistoryOmitList.createdAt,
				updatedAt: arcBrowsingHistoryOmitList.updatedAt,
			})
			.from(arcBrowsingHistoryOmitList)
			.orderBy(arcBrowsingHistoryOmitList.pattern);
	}),
	getCounts: publicProcedure.query(({ ctx: { db } }) => {
		return db
			.select({
				pattern: arcBrowsingHistoryOmitList.pattern,
				matchCount: db.$count(
					arcBrowsingHistory,
					ilike(arcBrowsingHistory.url, sql`${arcBrowsingHistoryOmitList.pattern}`)
				),
			})
			.from(arcBrowsingHistoryOmitList)
			.orderBy(arcBrowsingHistoryOmitList.pattern);
	}),
	createPattern: publicProcedure.input(z.string()).mutation(({ ctx: { db }, input: pattern }) => {
		return db.insert(arcBrowsingHistoryOmitList).values({ pattern }).returning();
	}),
	updatePattern: publicProcedure
		.input(z.object({ oldPattern: z.string(), newPattern: z.string() }))
		.mutation(({ ctx: { db }, input: { oldPattern, newPattern } }) => {
			return db
				.update(arcBrowsingHistoryOmitList)
				.set({ pattern: newPattern, updatedAt: new Date() })
				.where(eq(arcBrowsingHistoryOmitList.pattern, oldPattern))
				.returning();
		}),
	deletePattern: publicProcedure.input(z.string()).mutation(({ ctx: { db }, input: pattern }) => {
		return db
			.delete(arcBrowsingHistoryOmitList)
			.where(eq(arcBrowsingHistoryOmitList.pattern, pattern))
			.returning();
	}),
});
