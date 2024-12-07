import { databaseTimestamps, databaseTimestampsNonUpdatable } from '../../operations/common';
import { relations, sql } from 'drizzle-orm';
import { serial, timestamp, text, bigint, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '..';
import { z } from 'zod';

export const Browser = z.enum(['arc', 'chrome', 'firefox', 'safari', 'edge']);
export type Browser = z.infer<typeof Browser>;
export const browserEnum = integrationSchema.enum('browser', Browser.options);

export const arcBrowsingHistory = integrationSchema.table(
	'arc_browsing_history',
	{
		id: serial('id').primaryKey(),
		viewTime: timestamp('view_time', {
			withTimezone: true,
		}).notNull(),
		browser: browserEnum('browser').notNull().default(Browser.enum.arc),
		hostname: text('hostname'),
		viewEpochMicroseconds: bigint('view_epoch_microseconds', { mode: 'bigint' }),
		viewDuration: integer('view_duration'),
		durationSinceLastView: integer('duration_since_last_view'),
		url: text('url').notNull(),
		pageTitle: text('page_title'),
		searchTerms: text('search_terms'),
		relatedSearches: text('related_searches'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...databaseTimestampsNonUpdatable,
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.viewTime),
		index('arc_browsing_history_url_idx').on(table.url),
		index().on(table.viewEpochMicroseconds),
		index().on(table.hostname),
	]
);

export const arcBrowsingHistoryOmitList = integrationSchema.table(
	'arc_browsing_history_omit_list',
	{
		pattern: text('pattern').primaryKey().notNull(),
		...databaseTimestamps,
	}
);

export const arcBrowsingHistoryRelations = relations(arcBrowsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [arcBrowsingHistory.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const arcBrowsingHistoryDaily = integrationSchema
	.materializedView('arc_browsing_history_daily')
	.as((qb) =>
		qb
			.select({
				date: sql<Date>`DATE(${arcBrowsingHistory.viewTime} AT TIME ZONE CURRENT_SETTING('timezone'))`.as(
					'date'
				),
				url: sql<string>`${arcBrowsingHistory.url}`.as('url'),
				pageTitle: sql<string>`${arcBrowsingHistory.pageTitle}`.as('page_title'),
				hostname: sql<string>`${arcBrowsingHistory.hostname}`.as('hostname'),
				totalDuration: sql<number>`SUM(COALESCE(${arcBrowsingHistory.viewDuration}, 0))`.as(
					'total_duration'
				),
				firstVisit: sql<Date>`MIN(${arcBrowsingHistory.viewTime})`.as('first_visit'),
				lastVisit: sql<Date>`MAX(${arcBrowsingHistory.viewTime})`.as('last_visit'),
				visitCount: sql<number>`COUNT(*)`.as('visit_count'),
			})
			.from(arcBrowsingHistory)
			.groupBy(
				sql<Date>`DATE(${arcBrowsingHistory.viewTime} AT TIME ZONE CURRENT_SETTING('timezone'))`,
				arcBrowsingHistory.url,
				arcBrowsingHistory.pageTitle,
				arcBrowsingHistory.hostname
			)
	);

export type ArcBrowsingHistory = typeof arcBrowsingHistory.$inferSelect;
export type NewArcBrowsingHistory = typeof arcBrowsingHistory.$inferInsert;
export type ArcBrowsingHistoryOmitList = typeof arcBrowsingHistoryOmitList.$inferSelect;
export type NewArcBrowsingHistoryOmitList = typeof arcBrowsingHistoryOmitList.$inferInsert;
