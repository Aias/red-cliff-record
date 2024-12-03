import { timestamps } from './common';
import { relations, sql } from 'drizzle-orm';
import { pgSchema, serial, timestamp, text, bigint, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';
import { z } from 'zod';

export const arcSchema = pgSchema('arc');

export const Browser = z.enum(['arc', 'chrome', 'firefox', 'safari', 'edge']);
export type Browser = z.infer<typeof Browser>;
export const browserEnum = arcSchema.enum('browser', Browser.options);

export const browsingHistory = arcSchema.table(
	'browsing_history',
	{
		id: serial().primaryKey(),
		viewTime: timestamp({
			withTimezone: true,
		}).notNull(),
		browser: browserEnum().notNull().default(Browser.enum.arc),
		hostname: text(),
		viewEpochMicroseconds: bigint({ mode: 'bigint' }),
		viewDuration: integer(),
		durationSinceLastView: integer(),
		url: text().notNull(),
		pageTitle: text().notNull(),
		searchTerms: text(),
		relatedSearches: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps,
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.viewTime),
		index().on(table.url),
		index().on(table.viewEpochMicroseconds),
		index().on(table.hostname),
	]
);

export const browsingHistoryOmitList = arcSchema.table('browsing_history_omit_list', {
	pattern: text().primaryKey().notNull(),
	...timestamps,
});

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const browsingHistoryDaily = arcSchema.materializedView('browsing_history_daily').as((qb) =>
	qb
		.select({
			date: sql<Date>`DATE(${browsingHistory.viewTime} AT TIME ZONE CURRENT_SETTING('timezone'))`.as(
				'date'
			),
			url: sql<string>`${browsingHistory.url}`.as('url'),
			pageTitle: sql<string>`${browsingHistory.pageTitle}`.as('page_title'),
			hostname: sql<string>`${browsingHistory.hostname}`.as('hostname'),
			totalDuration: sql<number>`SUM(COALESCE(${browsingHistory.viewDuration}, 0))`.as(
				'total_duration'
			),
			firstVisit: sql<Date>`MIN(${browsingHistory.viewTime})`.as('first_visit'),
			lastVisit: sql<Date>`MAX(${browsingHistory.viewTime})`.as('last_visit'),
			visitCount: sql<number>`COUNT(*)`.as('visit_count'),
		})
		.from(browsingHistory)
		.groupBy(
			sql<Date>`DATE(${browsingHistory.viewTime} AT TIME ZONE CURRENT_SETTING('timezone'))`,
			browsingHistory.url,
			browsingHistory.pageTitle,
			browsingHistory.hostname
		)
);

export type BrowsingHistory = typeof browsingHistory.$inferSelect;
export type NewBrowsingHistory = typeof browsingHistory.$inferInsert;
export type BrowsingHistoryOmitList = typeof browsingHistoryOmitList.$inferSelect;
export type NewBrowsingHistoryOmitList = typeof browsingHistoryOmitList.$inferInsert;
