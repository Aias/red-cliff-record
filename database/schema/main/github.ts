import { stats } from '@schema/common/stats';
import { timestamps } from '@schema/common/timestamps';
import { relations } from 'drizzle-orm';
import {
	pgSchema,
	serial,
	text,
	timestamp,
	integer,
	boolean,
	index,
	unique
} from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';

export const githubSchema = pgSchema('github');

export const commits = githubSchema.table('commits', {
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

export const commitsRelations = relations(commits, ({ many, one }) => ({
	commitChanges: many(commitChanges),
	integrationRun: one(integrationRuns, {
		fields: [commits.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export enum CommitChangeStatus {
	ADDED = 'added',
	MODIFIED = 'modified',
	REMOVED = 'removed',
	RENAMED = 'renamed',
	COPIED = 'copied',
	CHANGED = 'changed',
	UNCHANGED = 'unchanged'
}

export const commitChangeStatusEnum = githubSchema.enum('commit_change_status', [
	CommitChangeStatus.ADDED,
	CommitChangeStatus.MODIFIED,
	CommitChangeStatus.REMOVED,
	CommitChangeStatus.RENAMED,
	CommitChangeStatus.COPIED,
	CommitChangeStatus.CHANGED,
	CommitChangeStatus.UNCHANGED
]);

export const commitChanges = githubSchema.table('commit_changes', {
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

export const commitChangesRelations = relations(commitChanges, ({ one }) => ({
	commit: one(commits, {
		fields: [commitChanges.commitId],
		references: [commits.id]
	})
}));

export const stars = githubSchema.table(
	'stars',
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

export const starsRelations = relations(stars, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [stars.integrationRunId],
		references: [integrationRuns.id]
	})
}));
