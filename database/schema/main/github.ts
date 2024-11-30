import { stats } from '@schema/common/stats';
import { timestamps } from '@schema/common/timestamps';
import { relations } from 'drizzle-orm';
import { pgSchema, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';
import { z } from 'zod';

export const githubSchema = pgSchema('github');

export const commits = githubSchema.table('commits', {
	id: serial().primaryKey(),
	sha: text().notNull(),
	message: text().notNull(),
	repository: text().notNull(),
	url: text().notNull(),
	committer: text(),
	commitDate: timestamp({
		withTimezone: true,
	}).notNull(),
	integrationRunId: integer()
		.references(() => integrationRuns.id)
		.notNull(),
	...stats,
	...timestamps,
});

export const commitsRelations = relations(commits, ({ many, one }) => ({
	commitChanges: many(commitChanges),
	integrationRun: one(integrationRuns, {
		fields: [commits.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const CommitChangeStatus = z.enum([
	'added',
	'modified',
	'removed',
	'renamed',
	'copied',
	'changed',
	'unchanged',
]);

export const commitChangeStatusEnum = githubSchema.enum(
	'commit_change_status',
	CommitChangeStatus.options
);

export const commitChanges = githubSchema.table('commit_changes', {
	id: serial().primaryKey(),
	filename: text().notNull(),
	status: commitChangeStatusEnum().notNull(),
	patch: text().notNull(),
	commitId: integer()
		.references(() => commits.id)
		.notNull(),
	...stats,
	...timestamps,
});

export const commitChangesRelations = relations(commitChanges, ({ one }) => ({
	commit: one(commits, {
		fields: [commitChanges.commitId],
		references: [commits.id],
	}),
}));

export const stars = githubSchema.table(
	'stars',
	{
		id: integer().primaryKey(),
		repoUrl: text().notNull(),
		homepageUrl: text(),
		name: text(),
		fullName: text(),
		ownerLogin: text(),
		licenseName: text(),
		description: text(),
		language: text(),
		topics: text().array(),
		starredAt: timestamp({
			withTimezone: true,
		}).notNull(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps,
	},
	(table) => [index().on(table.integrationRunId), index().on(table.starredAt)]
);

export const starsRelations = relations(stars, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [stars.integrationRunId],
		references: [integrationRuns.id],
	}),
}));
