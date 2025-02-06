import { eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { browsingHistory, browsingHistoryOmitList } from '~/server/db/schema/history';
import { createTRPCRouter, mergeRouters, publicProcedure } from '../init';

const browserHistoryRouter = createTRPCRouter({
	getHistoryForDate: publicProcedure
		.input(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
		.query(({ ctx: { db }, input: date }) => {
			const tzOffset = new Date().getTimezoneOffset();
			const adjustedOffset = -tzOffset;

			return db
				.select({
					hostname: browsingHistory.hostname,
					url: browsingHistory.url,
					pageTitle: browsingHistory.pageTitle,
					totalDuration: sql<number>`sum(${browsingHistory.viewDuration})`,
					visitCount: sql<number>`count(*)`,
					firstVisit: sql<string>`min(${browsingHistory.viewTime})`,
					lastVisit: sql<string>`max(${browsingHistory.viewTime})`,
				})
				.from(browsingHistory)
				.where(
					sql`DATE(${browsingHistory.viewTime} + INTERVAL ${sql.raw(`'${adjustedOffset} MINUTES'`)}) = to_date(${date}, 'YYYY-MM-DD') AND NOT EXISTS (
					SELECT 1 FROM ${browsingHistoryOmitList}
					WHERE ${browsingHistory.url} LIKE ${browsingHistoryOmitList.pattern}
				)`
				)
				.groupBy(browsingHistory.hostname, browsingHistory.url, browsingHistory.pageTitle)
				.orderBy(sql`min(${browsingHistory.viewTime})`);
		}),
});

const omitListRouter = createTRPCRouter({
	getOmitList: publicProcedure.query(({ ctx: { db } }) => {
		return db
			.select({
				pattern: browsingHistoryOmitList.pattern,
				recordCreatedAt: browsingHistoryOmitList.recordCreatedAt,
				recordUpdatedAt: browsingHistoryOmitList.recordUpdatedAt,
			})
			.from(browsingHistoryOmitList)
			.orderBy(browsingHistoryOmitList.pattern);
	}),

	getOmittedCounts: publicProcedure.query(({ ctx: { db } }) => {
		return db
			.select({
				pattern: browsingHistoryOmitList.pattern,
				matchCount: db.$count(
					browsingHistory,
					ilike(browsingHistory.url, sql`${browsingHistoryOmitList.pattern}`)
				),
			})
			.from(browsingHistoryOmitList)
			.orderBy(browsingHistoryOmitList.pattern);
	}),

	createOmitPattern: publicProcedure
		.input(z.string())
		.mutation(({ ctx: { db }, input: pattern }) => {
			return db.insert(browsingHistoryOmitList).values({ pattern }).returning();
		}),

	updateOmitPattern: publicProcedure
		.input(z.object({ oldPattern: z.string(), newPattern: z.string() }))
		.mutation(({ ctx: { db }, input: { oldPattern, newPattern } }) => {
			return db
				.update(browsingHistoryOmitList)
				.set({ pattern: newPattern, recordUpdatedAt: new Date() })
				.where(eq(browsingHistoryOmitList.pattern, oldPattern))
				.returning();
		}),

	deleteOmitPattern: publicProcedure
		.input(z.string())
		.mutation(({ ctx: { db }, input: pattern }) => {
			return db
				.delete(browsingHistoryOmitList)
				.where(eq(browsingHistoryOmitList.pattern, pattern))
				.returning();
		}),
});

export const historyRouter = mergeRouters(browserHistoryRouter, omitListRouter);
