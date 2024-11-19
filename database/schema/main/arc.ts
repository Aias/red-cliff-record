import { timestamps } from '@schema/common/timestamps';
import { relations, sql } from 'drizzle-orm';
import { pgSchema, serial, timestamp, text, bigint, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';

export const arcSchema = pgSchema('arc');

export enum Browser {
	ARC = 'arc',
	CHROME = 'chrome',
	FIREFOX = 'firefox',
	SAFARI = 'safari',
	EDGE = 'edge'
}

export const browserEnum = arcSchema.enum('browser', [
	Browser.ARC,
	Browser.CHROME,
	Browser.FIREFOX,
	Browser.SAFARI,
	Browser.EDGE
]);

export const browsingHistory = arcSchema.table(
	'browsing_history',
	{
		id: serial().primaryKey(),
		viewTime: timestamp().notNull(),
		browser: browserEnum().notNull().default(Browser.ARC),
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
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.viewTime),
		index().on(table.url),
		index().on(table.viewEpochMicroseconds),
		index().on(table.hostname)
	]
);

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const browsingHistoryDaily = arcSchema.materializedView('browsing_history_daily').as((qb) =>
	qb
		.select({
			date: sql<Date>`DATE(${browsingHistory.viewTime})`.as('date'),
			url: browsingHistory.url,
			pageTitle: browsingHistory.pageTitle,
			totalDuration: sql<number>`SUM(COALESCE(${browsingHistory.viewDuration}, 0))`.as(
				'total_duration'
			),
			firstVisit: sql<Date>`MIN(${browsingHistory.viewTime})`.as('first_visit'),
			lastVisit: sql<Date>`MAX(${browsingHistory.viewTime})`.as('last_visit'),
			visitCount: sql<number>`COUNT(*)`.as('visit_count')
		})
		.from(browsingHistory)
		.groupBy(sql`DATE(${browsingHistory.viewTime})`, browsingHistory.url, browsingHistory.pageTitle)
);
