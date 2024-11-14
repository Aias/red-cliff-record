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
	unique,
	primaryKey,
	foreignKey
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { timestamps } from '../common/timestamps';
import { stats } from '../common/stats';
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

export const airtableExtracts = pgTable(
	'airtable_extracts',
	{
		id: text().primaryKey(),
		title: text().notNull(),
		format: text().notNull().default('Fragment'),
		source: text(),
		michelinStars: integer(),
		content: text(),
		notes: text(),
		attachmentCaption: text(),
		parentId: text(),
		lexicographicalOrder: text().notNull().default('a0'),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		publishedAt: timestamp(),
		...timestamps
	},
	(table) => [
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id]
		})
	]
);

export const airtableExtractsRelations = relations(airtableExtracts, ({ many, one }) => ({
	children: many(airtableExtracts, {
		relationName: 'parentChild'
	}),
	parent: one(airtableExtracts, {
		fields: [airtableExtracts.parentId],
		references: [airtableExtracts.id],
		relationName: 'parentChild'
	}),
	extractCreators: many(airtableExtractCreators, { relationName: 'extractToCreator' }),
	extractSpaces: many(airtableExtractSpaces, { relationName: 'extractToSpace' }),
	outgoingConnections: many(airtableExtractConnections, { relationName: 'fromExtract' }),
	incomingConnections: many(airtableExtractConnections, { relationName: 'toExtract' }),
	attachments: many(airtableAttachments),
	integrationRun: one(integrationRuns, {
		fields: [airtableExtracts.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const airtableAttachments = pgTable('airtable_attachments', {
	id: text().primaryKey(),
	url: text().notNull(),
	filename: text().notNull(),
	size: integer(),
	type: text(),
	width: integer(),
	height: integer(),
	extractId: text()
		.references(() => airtableExtracts.id)
		.notNull(),
	...timestamps
});

export const airtableAttachmentsRelations = relations(airtableAttachments, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableAttachments.extractId],
		references: [airtableExtracts.id]
	})
}));

export const airtableCreators = pgTable('airtable_creators', {
	id: text().primaryKey(),
	name: text().notNull(),
	type: text().notNull().default('Individual'),
	primaryProject: text(),
	website: text(),
	professions: text().array(),
	organizations: text().array(),
	nationalities: text().array(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...timestamps
});

export const airtableCreatorsRelations = relations(airtableCreators, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableCreators.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const airtableSpaces = pgTable('airtable_spaces', {
	id: text().primaryKey(),
	name: text().notNull(),
	fullName: text(),
	icon: text(),
	description: text(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...timestamps
});

export const airtableSpacesRelations = relations(airtableSpaces, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [airtableSpaces.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const airtableExtractCreators = pgTable(
	'airtable_extract_creators',
	{
		extractId: text()
			.references(() => airtableExtracts.id)
			.notNull(),
		creatorId: text()
			.references(() => airtableCreators.id)
			.notNull(),
		...timestamps
	},
	(table) => [primaryKey({ columns: [table.extractId, table.creatorId] })]
);

export const airtableExtractCreatorsRelations = relations(airtableExtractCreators, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableExtractCreators.extractId],
		references: [airtableExtracts.id],
		relationName: 'extractToCreator'
	}),
	creator: one(airtableCreators, {
		fields: [airtableExtractCreators.creatorId],
		references: [airtableCreators.id],
		relationName: 'creatorToExtract'
	})
}));

export const airtableExtractSpaces = pgTable(
	'airtable_extract_spaces',
	{
		extractId: text()
			.references(() => airtableExtracts.id)
			.notNull(),
		spaceId: text()
			.references(() => airtableSpaces.id)
			.notNull(),
		...timestamps
	},
	(table) => [primaryKey({ columns: [table.extractId, table.spaceId] })]
);

export const airtableExtractSpacesRelations = relations(airtableExtractSpaces, ({ one }) => ({
	extract: one(airtableExtracts, {
		fields: [airtableExtractSpaces.extractId],
		references: [airtableExtracts.id],
		relationName: 'extractToSpace'
	}),
	space: one(airtableSpaces, {
		fields: [airtableExtractSpaces.spaceId],
		references: [airtableSpaces.id],
		relationName: 'spaceToExtract'
	})
}));

export const airtableExtractConnections = pgTable(
	'airtable_extract_connections',
	{
		fromExtractId: text()
			.references(() => airtableExtracts.id)
			.notNull(),
		toExtractId: text()
			.references(() => airtableExtracts.id)
			.notNull(),
		...timestamps
	},
	(table) => [primaryKey({ columns: [table.fromExtractId, table.toExtractId] })]
);

export const airtableExtractConnectionsRelations = relations(
	airtableExtractConnections,
	({ one }) => ({
		fromExtract: one(airtableExtracts, {
			relationName: 'fromExtract',
			fields: [airtableExtractConnections.fromExtractId],
			references: [airtableExtracts.id]
		}),
		toExtract: one(airtableExtracts, {
			relationName: 'toExtract',
			fields: [airtableExtractConnections.toExtractId],
			references: [airtableExtracts.id]
		})
	})
);
