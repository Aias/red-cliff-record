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
import { timestamps } from './common/timestamps';
import { stats } from './common/stats';

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
	GITHUB = 'github',
	TWITTER = 'twitter'
}

export const integrationTypeEnum = pgEnum('integration_type', [
	IntegrationType.BROWSER_HISTORY,
	IntegrationType.AIRTABLE,
	IntegrationType.AI_CHAT,
	IntegrationType.RAINDROP,
	IntegrationType.GITHUB,
	IntegrationType.TWITTER
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

export const commits = pgTable('commits', {
	id: serial().primaryKey(),
	sha: text().notNull(),
	message: text().notNull(),
	repository: text().notNull(),
	url: text().notNull(),
	committer: text(),
	commitDate: timestamp().notNull(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...stats,
	...timestamps
});


// "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged"
export enum CommitChangeStatus {
	ADDED = 'added',
	MODIFIED = 'modified',
	REMOVED = 'removed',
	RENAMED = 'renamed',
	COPIED = 'copied',
	CHANGED = 'changed',
	UNCHANGED = 'unchanged'
}

export const commitChangeStatusEnum = pgEnum('commit_change_status', [
	CommitChangeStatus.ADDED,
	CommitChangeStatus.MODIFIED,
	CommitChangeStatus.REMOVED,
	CommitChangeStatus.RENAMED,
	CommitChangeStatus.COPIED,
	CommitChangeStatus.CHANGED,
	CommitChangeStatus.UNCHANGED
]);

export const commitChanges = pgTable('commit_changes', {
	id: serial().primaryKey(),
	filename: text().notNull(),
	status: commitChangeStatusEnum().notNull(),
	patch: text().notNull(),
	commitId: integer()
		.references(() => commits.id)
		.notNull(),
	...stats,
	...timestamps
});

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(browsingHistory),
	bookmarks: many(bookmarks),
	commits: many(commits)
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

export const commitsRelations = relations(commits, ({ many, one }) => ({
	commitChanges: many(commitChanges),
	integrationRun: one(integrationRuns, {
		fields: [commits.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const commitChangesRelations = relations(commitChanges, ({ one }) => ({
	commit: one(commits, {
		fields: [commitChanges.commitId],
		references: [commits.id]
	})
}));


