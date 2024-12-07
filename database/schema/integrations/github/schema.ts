import {
	contentTimestamps,
	databaseTimestamps,
	databaseTimestampsNonUpdatable,
} from '../../operations/common';
import { relations } from 'drizzle-orm';
import { serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '..';
import { z } from 'zod';

export const githubStats = {
	changes: integer('changes'),
	additions: integer('additions'),
	deletions: integer('deletions'),
};

export const githubCommits = integrationSchema.table('github_commits', {
	id: serial('id').primaryKey(),
	sha: text('sha').notNull(),
	message: text('message').notNull(),
	repository: text('repository').notNull(),
	url: text('url').notNull(),
	committer: text('committer'),
	commitDate: timestamp('commit_date', {
		withTimezone: true,
	}).notNull(),
	integrationRunId: integer('integration_run_id')
		.references(() => integrationRuns.id)
		.notNull(),
	...githubStats,
	...contentTimestamps,
	...databaseTimestampsNonUpdatable,
});

export const githubCommitsRelations = relations(githubCommits, ({ many, one }) => ({
	commitChanges: many(githubCommitChanges),
	integrationRun: one(integrationRuns, {
		fields: [githubCommits.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const GithubCommitChangeStatus = z.enum([
	'added',
	'modified',
	'removed',
	'renamed',
	'copied',
	'changed',
	'unchanged',
]);
export type GithubCommitChangeStatus = z.infer<typeof GithubCommitChangeStatus>;
export const githubCommitChangeStatusEnum = integrationSchema.enum(
	'github_commit_change_status',
	GithubCommitChangeStatus.options
);

export const githubCommitChanges = integrationSchema.table('github_commit_changes', {
	id: serial('id').primaryKey(),
	filename: text('filename').notNull(),
	status: githubCommitChangeStatusEnum('status').notNull(),
	patch: text('patch').notNull(),
	commitId: integer('commit_id')
		.references(() => githubCommits.id)
		.notNull(),
	...githubStats,
	...databaseTimestampsNonUpdatable,
});

export const githubCommitChangesRelations = relations(githubCommitChanges, ({ one }) => ({
	commit: one(githubCommits, {
		fields: [githubCommitChanges.commitId],
		references: [githubCommits.id],
	}),
}));

export const githubStars = integrationSchema.table(
	'github_stars',
	{
		id: integer('id').primaryKey(),
		repoUrl: text('repo_url').notNull(),
		homepageUrl: text('homepage_url'),
		name: text('name'),
		fullName: text('full_name'),
		ownerLogin: text('owner_login'),
		licenseName: text('license_name'),
		description: text('description'),
		language: text('language'),
		topics: text('topics').array(),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.integrationRunId), index().on(table.contentCreatedAt)]
);

export const githubStarsRelations = relations(githubStars, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [githubStars.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export type GithubStar = typeof githubStars.$inferSelect;
export type NewGithubStar = typeof githubStars.$inferInsert;
export type GithubCommit = typeof githubCommits.$inferSelect;
export type NewGithubCommit = typeof githubCommits.$inferInsert;
export type GithubCommitChange = typeof githubCommitChanges.$inferSelect;
export type NewGithubCommitChange = typeof githubCommitChanges.$inferInsert;
