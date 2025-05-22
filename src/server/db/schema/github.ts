import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import {
	contentTimestamps,
	contentTimestampsNonUpdatable,
	databaseTimestamps,
	databaseTimestampsNonUpdatable,
} from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

const githubStats = {
	changes: integer('changes'),
	additions: integer('additions'),
	deletions: integer('deletions'),
};

export const githubUsers = pgTable(
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
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		deletedAt: timestamp('deleted_at', {
			withTimezone: true,
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.login), index().on(table.recordId), index().on(table.deletedAt)]
);

export const GithubUserSelectSchema = createSelectSchema(githubUsers);
export type GithubUserSelect = typeof githubUsers.$inferSelect;
export const GithubUserInsertSchema = createInsertSchema(githubUsers);
export type GithubUserInsert = typeof githubUsers.$inferInsert;

export const githubRepositories = pgTable(
	'github_repositories',
	{
		id: integer('id').primaryKey(),
		nodeId: text('node_id').notNull().unique(),
		name: text('name').notNull(),
		fullName: text('full_name').notNull(),
		ownerId: integer('owner_id')
			.references(() => githubUsers.id, {
				onDelete: 'set null',
				onUpdate: 'cascade',
			})
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
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		deletedAt: timestamp('deleted_at', {
			withTimezone: true,
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.ownerId),
		index().on(table.nodeId),
		index().on(table.recordId),
		index().on(table.deletedAt),
	]
);

export const GithubRepositorySelectSchema = createSelectSchema(githubRepositories);
export type GithubRepositorySelect = typeof githubRepositories.$inferSelect;
export const GithubRepositoryInsertSchema = createInsertSchema(githubRepositories);
export type GithubRepositoryInsert = typeof githubRepositories.$inferInsert;

export const GithubCommitType = z.enum([
	'feature',
	'enhancement',
	'bugfix',
	'refactor',
	'documentation',
	'style',
	'chore',
	'test',
	'build',
]);
export type GithubCommitType = z.infer<typeof GithubCommitType>;

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

export const githubCommitTypesEnum = pgEnum('github_commit_types', [
	'feature',
	'enhancement',
	'bugfix',
	'refactor',
	'documentation',
	'style',
	'chore',
	'test',
	'build',
] as const);

export const githubCommits = pgTable(
	'github_commits',
	{
		id: text('id').primaryKey(),
		sha: text('sha').notNull().unique(),
		message: text('message').notNull(),
		repositoryId: integer('repository_id')
			.references(() => githubRepositories.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		htmlUrl: text('html_url').notNull(),
		commitType: githubCommitTypesEnum('commit_type'),
		summary: text('summary'),
		technologies: text('technologies').array(),
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

export const GithubCommitSelectSchema = createSelectSchema(githubCommits);
export type GithubCommitSelect = typeof githubCommits.$inferSelect;
export const GithubCommitInsertSchema = createInsertSchema(githubCommits);
export type GithubCommitInsert = typeof githubCommits.$inferInsert;

export const githubCommitChangeStatusEnum = pgEnum('github_commit_change_status', [
	'added',
	'modified',
	'removed',
	'renamed',
	'copied',
	'changed',
	'unchanged',
] as const);

export const githubCommitChanges = pgTable(
	'github_commit_changes',
	{
		id: serial('id').primaryKey(),
		filename: text('filename').notNull(),
		status: githubCommitChangeStatusEnum('status').notNull(),
		patch: text('patch').notNull(),
		commitId: text('commit_id')
			.references(() => githubCommits.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		...githubStats,
		...databaseTimestampsNonUpdatable,
	},
	(table) => [index().on(table.commitId), index().on(table.filename)]
);

export const GithubCommitChangeSelectSchema = createSelectSchema(githubCommitChanges);
export type GithubCommitChangeSelect = typeof githubCommitChanges.$inferSelect;
export const GithubCommitChangeInsertSchema = createInsertSchema(githubCommitChanges);
export type GithubCommitChangeInsert = typeof githubCommitChanges.$inferInsert;
