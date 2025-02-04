import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	vector,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
	contentTimestamps,
	contentTimestampsNonUpdatable,
	databaseTimestamps,
	databaseTimestampsNonUpdatable,
} from '../common';
import { indices, records } from '../main';
import { integrationRuns } from '../operations';

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
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		embedding: vector('embedding', { dimensions: 768 }),
	},
	(table) => [index().on(table.login), index().on(table.archivedAt), index().on(table.indexEntryId)]
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
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		embedding: vector('embedding', { dimensions: 768 }),
	},
	(table) => [
		index().on(table.ownerId),
		index().on(table.nodeId),
		index().on(table.archivedAt),
		index().on(table.recordId),
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

export const githubCommitTypesEnum = pgEnum('github_commit_types', GithubCommitType.options);

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
		embedding: vector('embedding', { dimensions: 768 }),
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

export const githubCommitChangeStatusEnum = pgEnum(
	'github_commit_change_status',
	GithubCommitChangeStatus.options
);

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

export const githubUsersRelations = relations(githubUsers, ({ one, many }) => ({
	repositories: many(githubRepositories),
	integrationRun: one(integrationRuns, {
		fields: [githubUsers.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indices, {
		relationName: 'indexEntry',
		fields: [githubUsers.indexEntryId],
		references: [indices.id],
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
	record: one(records, {
		fields: [githubRepositories.recordId],
		references: [records.id],
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
		references: [githubCommits.id],
	}),
}));

export const githubIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	githubUsers: many(githubUsers),
	githubRepositories: many(githubRepositories),
	githubCommits: many(githubCommits),
}));
