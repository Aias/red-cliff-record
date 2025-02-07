import { relations } from 'drizzle-orm';
import {
	bigint,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { databaseTimestamps, databaseTimestampsNonUpdatable } from './operations';
import { integrationRuns } from './operations';

export const Browser = z.enum(['arc', 'chrome', 'firefox', 'safari', 'edge']);
export type Browser = z.infer<typeof Browser>;

export const browserEnum = pgEnum('browser', Browser.options);

export const browsingHistory = pgTable(
	'browsing_history',
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
		index('browsing_history_url_idx').on(table.url),
		index().on(table.viewEpochMicroseconds),
		index().on(table.hostname),
	]
);

export const BrowsingHistorySelectSchema = createSelectSchema(browsingHistory);
export type BrowsingHistorySelect = typeof browsingHistory.$inferSelect;
export const BrowsingHistoryInsertSchema = createInsertSchema(browsingHistory);
export type BrowsingHistoryInsert = typeof browsingHistory.$inferInsert;

export const browsingHistoryOmitList = pgTable('browsing_history_omit_list', {
	pattern: text('pattern').primaryKey().notNull(),
	...databaseTimestamps,
});

export const BrowsingHistoryOmitListSelectSchema = createSelectSchema(browsingHistoryOmitList);
export type BrowsingHistoryOmitListSelect = typeof browsingHistoryOmitList.$inferSelect;
export const BrowsingHistoryOmitListInsertSchema = createInsertSchema(browsingHistoryOmitList);
export type BrowsingHistoryOmitListInsert = typeof browsingHistoryOmitList.$inferInsert;

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const integrationRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(browsingHistory),
}));
