import { relations } from 'drizzle-orm';
import { bigint, index, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { databaseTimestamps, databaseTimestampsNonUpdatable } from '../common';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

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
		hostname: text('hostname').notNull(),
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

export const ArcBrowsingHistorySelectSchema = createSelectSchema(arcBrowsingHistory);
export type ArcBrowsingHistorySelect = typeof arcBrowsingHistory.$inferSelect;
export const ArcBrowsingHistoryInsertSchema = createInsertSchema(arcBrowsingHistory);
export type ArcBrowsingHistoryInsert = typeof arcBrowsingHistory.$inferInsert;

export const arcBrowsingHistoryOmitList = integrationSchema.table(
	'arc_browsing_history_omit_list',
	{
		pattern: text('pattern').primaryKey().notNull(),
		...databaseTimestamps,
	}
);

export const ArcBrowsingHistoryOmitListSelectSchema = createSelectSchema(
	arcBrowsingHistoryOmitList
);
export type ArcBrowsingHistoryOmitListSelect = typeof arcBrowsingHistoryOmitList.$inferSelect;
export const ArcBrowsingHistoryOmitListInsertSchema = createInsertSchema(
	arcBrowsingHistoryOmitList
);
export type ArcBrowsingHistoryOmitListInsert = typeof arcBrowsingHistoryOmitList.$inferInsert;

export const arcBrowsingHistoryRelations = relations(arcBrowsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [arcBrowsingHistory.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const arcIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	arcBrowsingHistory: many(arcBrowsingHistory),
}));
