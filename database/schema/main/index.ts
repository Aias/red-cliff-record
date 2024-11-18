import {
	integer,
	pgTable,
	text,
	timestamp,
	serial,
	pgEnum,
	index,
	boolean,
	pgMaterializedView,
	bigint,
	unique
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { timestamps } from '../common/timestamps';
import { integrationRuns } from './integrations';

export enum Browser {
	ARC = 'arc',
	CHROME = 'chrome',
	FIREFOX = 'firefox',
	SAFARI = 'safari',
	EDGE = 'edge'
}

export const browserEnum = pgEnum('browser', [
	Browser.ARC,
	Browser.CHROME,
	Browser.FIREFOX,
	Browser.SAFARI,
	Browser.EDGE
]);

// Browsing history table
export const browsingHistory = pgTable(
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
	(table) => [index().on(table.integrationRunId), index().on(table.viewTime), index().on(table.url)]
);

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const browsingHistoryDaily = pgMaterializedView('browsing_history_daily').as((qb) =>
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

export const bookmarks = pgTable(
	'bookmarks',
	{
		id: serial().primaryKey(),
		url: text().notNull(),
		title: text().notNull(),
		creator: text(),
		content: text(),
		notes: text(),
		type: text(),
		category: text(),
		tags: text().array(),
		important: boolean().notNull().default(false),
		imageUrl: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		bookmarkedAt: timestamp().defaultNow().notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.url),
		index().on(table.createdAt),
		unique().on(table.url, table.bookmarkedAt)
	]
);

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [bookmarks.integrationRunId],
		references: [integrationRuns.id]
	})
}));