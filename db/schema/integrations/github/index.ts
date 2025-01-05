import { relations } from 'drizzle-orm';
import { serial, text, integer, index, boolean, timestamp } from 'drizzle-orm/pg-core';
import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
	contentTimestamps,
	contentTimestampsNonUpdatable,
	databaseTimestamps,
	databaseTimestampsNonUpdatable,
} from '../../operations/common';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '../schema';
import { indexEntries, records } from '../../main';

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
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indexEntries.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [index().on(table.login), index().on(table.archivedAt), index().on(table.indexEntryId)]
);

export const githubRepositories = integrationSchema.table(
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
	},
	(table) => [
		index().on(table.ownerId),
		index().on(table.nodeId),
		index().on(table.archivedAt),
		index().on(table.recordId),
	]
);

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

export const githubCommitTypesEnum = integrationSchema.enum(
	'github_commit_types',
	GithubCommitType.options
);

export const githubCommits = integrationSchema.table(
	'github_commits',
	{
		nodeId: text('node_id').primaryKey(),
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
			.references(() => githubCommits.nodeId, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
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
	indexEntry: one(indexEntries, {
		fields: [githubUsers.indexEntryId],
		references: [indexEntries.id],
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
		references: [githubCommits.nodeId],
	}),
}));

export const githubIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	githubUsers: many(githubUsers),
	githubRepositories: many(githubRepositories),
	githubCommits: many(githubCommits),
}));

// Schema and type definitions
export const GithubUserSelectSchema = createSelectSchema(githubUsers);
export type GithubUserSelect = z.infer<typeof GithubUserSelectSchema>;
export const GithubUserInsertSchema = createInsertSchema(githubUsers);
export type GithubUserInsert = z.infer<typeof GithubUserInsertSchema>;
export const GithubUserUpdateSchema = createUpdateSchema(githubUsers);
export type GithubUserUpdate = z.infer<typeof GithubUserUpdateSchema>;

export const GithubRepositorySelectSchema = createSelectSchema(githubRepositories);
export type GithubRepositorySelect = z.infer<typeof GithubRepositorySelectSchema>;
export const GithubRepositoryInsertSchema = createInsertSchema(githubRepositories);
export type GithubRepositoryInsert = z.infer<typeof GithubRepositoryInsertSchema>;
export const GithubRepositoryUpdateSchema = createUpdateSchema(githubRepositories);
export type GithubRepositoryUpdate = z.infer<typeof GithubRepositoryUpdateSchema>;

export const GithubCommitSelectSchema = createSelectSchema(githubCommits);
export type GithubCommitSelect = z.infer<typeof GithubCommitSelectSchema>;
export const GithubCommitInsertSchema = createInsertSchema(githubCommits);
export type GithubCommitInsert = z.infer<typeof GithubCommitInsertSchema>;
export const GithubCommitUpdateSchema = createUpdateSchema(githubCommits);
export type GithubCommitUpdate = z.infer<typeof GithubCommitUpdateSchema>;

export const GithubCommitChangeSelectSchema = createSelectSchema(githubCommitChanges);
export type GithubCommitChangeSelect = z.infer<typeof GithubCommitChangeSelectSchema>;
export const GithubCommitChangeInsertSchema = createInsertSchema(githubCommitChanges);
export type GithubCommitChangeInsert = z.infer<typeof GithubCommitChangeInsertSchema>;
export const GithubCommitChangeUpdateSchema = createUpdateSchema(githubCommitChanges);
export type GithubCommitChangeUpdate = z.infer<typeof GithubCommitChangeUpdateSchema>;
