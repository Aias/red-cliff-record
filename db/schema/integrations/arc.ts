import { databaseTimestamps, databaseTimestampsNonUpdatable } from '../common';
import { relations } from 'drizzle-orm';
import { serial, timestamp, text, bigint, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

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
export type ArcBrowsingHistorySelect = z.infer<typeof ArcBrowsingHistorySelectSchema>;
export const ArcBrowsingHistoryInsertSchema = createInsertSchema(arcBrowsingHistory);
export type ArcBrowsingHistoryInsert = z.infer<typeof ArcBrowsingHistoryInsertSchema>;
export const ArcBrowsingHistoryUpdateSchema = createUpdateSchema(arcBrowsingHistory);
export type ArcBrowsingHistoryUpdate = z.infer<typeof ArcBrowsingHistoryUpdateSchema>;

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
export type ArcBrowsingHistoryOmitListSelect = z.infer<
	typeof ArcBrowsingHistoryOmitListSelectSchema
>;
export const ArcBrowsingHistoryOmitListInsertSchema = createInsertSchema(
	arcBrowsingHistoryOmitList
);
export type ArcBrowsingHistoryOmitListInsert = z.infer<
	typeof ArcBrowsingHistoryOmitListInsertSchema
>;
export const ArcBrowsingHistoryOmitListUpdateSchema = createUpdateSchema(
	arcBrowsingHistoryOmitList
);
export type ArcBrowsingHistoryOmitListUpdate = z.infer<
	typeof ArcBrowsingHistoryOmitListUpdateSchema
>;

export const arcBrowsingHistoryRelations = relations(arcBrowsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [arcBrowsingHistory.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const arcIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	arcBrowsingHistory: many(arcBrowsingHistory),
}));
