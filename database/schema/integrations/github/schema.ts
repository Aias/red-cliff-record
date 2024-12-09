import {
	contentTimestamps,
	contentTimestampsNonUpdatable,
	databaseTimestamps,
	databaseTimestampsNonUpdatable,
} from '../../operations/common';
import { relations } from 'drizzle-orm';
import { serial, text, integer, index, boolean, timestamp } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../../operations/schema';
import { integrationSchema } from '..';
import { GithubCommitChangeStatus } from './types';

const githubStats = {
	changes: integer('changes'),
	additions: integer('additions'),
	deletions: integer('deletions'),
};

export const githubUsers = integrationSchema.table(
	'github_users',
	{
		id: integer('id').primaryKey(),
		login: text('login').notNull(),
		nodeId: text('node_id').notNull().unique(),
		avatarUrl: text('avatar_url'),
		htmlUrl: text('html_url').notNull(),
		type: text('type').notNull(),
		partial: boolean('partial').notNull(),
		name: text('name'),
		company: text('company'),
		blog: text('blog'),
		location: text('location'),
		email: text('email'),
		bio: text('bio'),
		twitterUsername: text('twitter_username'),
		followers: integer('followers'),
		following: integer('following'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.login)]
);

export const githubRepositories = integrationSchema.table(
	'github_repositories',
	{
		id: integer('id').primaryKey(),
		nodeId: text('node_id').notNull().unique(),
		name: text('name').notNull(),
		fullName: text('full_name').notNull(),
		ownerId: integer('owner_id')
			.references(() => githubUsers.id)
			.notNull(),
		readme: text('readme'),
		private: boolean('private').notNull(),
		htmlUrl: text('html_url').notNull(),
		homepageUrl: text('homepage_url'),
		licenseName: text('license_name'),
		description: text('description'),
		language: text('language'),
		topics: text('topics').array(),
		starredAt: timestamp('starred_at', { withTimezone: true }),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.ownerId), index().on(table.nodeId)]
);

export const githubCommits = integrationSchema.table(
	'github_commits',
	{
		nodeId: text('node_id').primaryKey(),
		sha: text('sha').notNull().unique(),
		message: text('message').notNull(),
		repositoryId: integer('repository_id')
			.references(() => githubRepositories.id)
			.notNull(),
		htmlUrl: text('html_url').notNull(),
		// committerId: integer('committer_id')
		// 	.references(() => githubUsers.id)
		// 	.notNull(),
		// authorId: integer('author_id').references(() => githubUsers.id),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...githubStats,
		committedAt: timestamp('committed_at', { withTimezone: true }),
		...contentTimestampsNonUpdatable,
		...databaseTimestampsNonUpdatable,
	},
	(table) => [index().on(table.repositoryId), index().on(table.sha)]
);

export const githubCommitChangeStatusEnum = integrationSchema.enum(
	'github_commit_change_status',
	GithubCommitChangeStatus.options
);

export const githubCommitChanges = integrationSchema.table(
	'github_commit_changes',
	{
		id: serial('id').primaryKey(),
		filename: text('filename').notNull(),
		status: githubCommitChangeStatusEnum('status').notNull(),
		patch: text('patch').notNull(),
		commitId: text('commit_id')
			.references(() => githubCommits.nodeId)
			.notNull(),
		...githubStats,
		...databaseTimestampsNonUpdatable,
	},
	(table) => [index().on(table.commitId), index().on(table.filename)]
);

export const githubUsersRelations = relations(githubUsers, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [githubUsers.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const githubRepositoriesRelations = relations(githubRepositories, ({ one }) => ({
	owner: one(githubUsers, {
		fields: [githubRepositories.ownerId],
		references: [githubUsers.id],
	}),
	integrationRun: one(integrationRuns, {
		fields: [githubRepositories.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const githubCommitsRelations = relations(githubCommits, ({ many, one }) => ({
	commitChanges: many(githubCommitChanges),
	repository: one(githubRepositories, {
		fields: [githubCommits.repositoryId],
		references: [githubRepositories.id],
	}),
	integrationRun: one(integrationRuns, {
		fields: [githubCommits.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const githubCommitChangesRelations = relations(githubCommitChanges, ({ one }) => ({
	commit: one(githubCommits, {
		fields: [githubCommitChanges.commitId],
		references: [githubCommits.nodeId],
	}),
}));

export type GithubUser = typeof githubUsers.$inferSelect;
export type NewGithubUser = typeof githubUsers.$inferInsert;
export type GithubRepository = typeof githubRepositories.$inferSelect;
export type NewGithubRepository = typeof githubRepositories.$inferInsert;
export type GithubCommit = typeof githubCommits.$inferSelect;
export type NewGithubCommit = typeof githubCommits.$inferInsert;
export type GithubCommitChange = typeof githubCommitChanges.$inferSelect;
export type NewGithubCommitChange = typeof githubCommitChanges.$inferInsert;
