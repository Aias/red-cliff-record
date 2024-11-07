import {
	integer,
	pgTable,
	text,
	timestamp,
	serial,
	pgEnum,
	index,
	boolean,
	pgMaterializedView
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { timestamps } from '../lib/schema-helpers';

export enum IntegrationStatus {
	SUCCESS = 'success',
	FAIL = 'fail',
	IN_PROGRESS = 'in_progress'
}

// Define the status enum for integration runs
export const integrationStatusEnum = pgEnum('integration_status', [
	IntegrationStatus.SUCCESS,
	IntegrationStatus.FAIL,
	IntegrationStatus.IN_PROGRESS
]);

export enum IntegrationType {
	BROWSER_HISTORY = 'browser_history',
	AIRTABLE = 'airtable',
	AI_CHAT = 'ai_chat',
	RAINDROP = 'raindrop',
	GITHUB = 'github'
}

export const integrationTypeEnum = pgEnum('integration_type', [
	IntegrationType.BROWSER_HISTORY,
	IntegrationType.AIRTABLE,
	IntegrationType.AI_CHAT,
	IntegrationType.RAINDROP,
	IntegrationType.GITHUB
]);

export enum RunType {
	FULL = 'full',
	INCREMENTAL = 'incremental'
}

export const runTypeEnum = pgEnum('run_type', [RunType.FULL, RunType.INCREMENTAL]);

// Integration runs table
export const integrationRuns = pgTable(
	'integration_runs',
	{
		id: serial().primaryKey(),
		integrationType: integrationTypeEnum().notNull(),
		runType: runTypeEnum().notNull(),
		status: integrationStatusEnum().notNull().default(IntegrationStatus.IN_PROGRESS),
		message: text(),
		runStartTime: timestamp().notNull(),
		runEndTime: timestamp(),
		entriesCreated: integer().default(0),
		...timestamps
	},
	(table) => [index().on(table.integrationType)]
);

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
		browser: browserEnum().notNull().default(Browser.ARC),
		viewTime: timestamp().notNull(),
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
		content: text(),
		notes: text(),
		type: text(),
		category: text(),
		tags: text().array(),
		starred: boolean().notNull().default(false),
		imageUrl: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.url),
		index().on(table.starred),
		index().on(table.createdAt)
	]
);

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(browsingHistory)
}));

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [bookmarks.integrationRunId],
		references: [integrationRuns.id]
	})
}));
