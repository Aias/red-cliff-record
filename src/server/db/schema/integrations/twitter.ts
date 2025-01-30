import { relations } from 'drizzle-orm';
import { foreignKey, index, integer, text, timestamp, vector } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { type z } from 'zod';
import { contentTimestamps, databaseTimestamps } from '../common';
import { indices, records } from '../main';
import { media } from '../main/media';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

export const twitterTweets = integrationSchema.table(
	'twitter_tweets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id').references(() => twitterUsers.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		text: text('text'),
		quotedTweetId: text('quoted_tweet_id'),
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
		index().on(table.integrationRunId),
		foreignKey({
			columns: [table.quotedTweetId],
			foreignColumns: [table.id],
		}),
		index().on(table.archivedAt),
		index().on(table.recordId),
	]
);

export const TwitterTweetSelectSchema = createSelectSchema(twitterTweets);
export type TwitterTweetSelect = z.infer<typeof TwitterTweetSelectSchema>;
export const TwitterTweetInsertSchema = createInsertSchema(twitterTweets);
export type TwitterTweetInsert = z.infer<typeof TwitterTweetInsertSchema>;
export const TwitterTweetUpdateSchema = createUpdateSchema(twitterTweets);
export type TwitterTweetUpdate = z.infer<typeof TwitterTweetUpdateSchema>;

export const twitterTweetsRelations = relations(twitterTweets, ({ one, many }) => ({
	media: many(twitterMedia, { relationName: 'tweetMedia' }),
	user: one(twitterUsers, {
		fields: [twitterTweets.userId],
		references: [twitterUsers.id],
	}),
	quotedTweet: one(twitterTweets, {
		fields: [twitterTweets.quotedTweetId],
		references: [twitterTweets.id],
		relationName: 'quotedTweet',
	}),
	integrationRun: one(integrationRuns, {
		fields: [twitterTweets.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [twitterTweets.recordId],
		references: [records.id],
	}),
}));

export const twitterMedia = integrationSchema.table(
	'twitter_media',
	{
		id: text('id').primaryKey(),
		type: text('type'),
		url: text('url'),
		mediaUrl: text('media_url'),
		tweetId: text('tweet_id')
			.references(() => twitterTweets.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		mediaId: integer('media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.archivedAt), index().on(table.mediaId)]
);

export const TwitterMediaSelectSchema = createSelectSchema(twitterMedia);
export type TwitterMediaSelect = z.infer<typeof TwitterMediaSelectSchema>;
export const TwitterMediaInsertSchema = createInsertSchema(twitterMedia);
export type TwitterMediaInsert = z.infer<typeof TwitterMediaInsertSchema>;
export const TwitterMediaUpdateSchema = createUpdateSchema(twitterMedia);
export type TwitterMediaUpdate = z.infer<typeof TwitterMediaUpdateSchema>;

export const twitterMediaRelations = relations(twitterMedia, ({ one }) => ({
	tweet: one(twitterTweets, {
		fields: [twitterMedia.tweetId],
		references: [twitterTweets.id],
		relationName: 'tweetMedia',
	}),
	media: one(media, {
		fields: [twitterMedia.mediaId],
		references: [media.id],
	}),
}));

export const twitterUsers = integrationSchema.table(
	'twitter_users',
	{
		id: text('id').primaryKey(),
		username: text('username').notNull(),
		displayName: text('display_name').notNull(),
		description: text('description'),
		location: text('location'),
		url: text('url'),
		externalUrl: text('external_url'),
		profileImageUrl: text('profile_image_url'),
		profileBannerUrl: text('profile_banner_url'),
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
	(table) => [index().on(table.archivedAt), index().on(table.indexEntryId)]
);

export const TwitterUserSelectSchema = createSelectSchema(twitterUsers);
export type TwitterUserSelect = z.infer<typeof TwitterUserSelectSchema>;
export const TwitterUserInsertSchema = createInsertSchema(twitterUsers);
export type TwitterUserInsert = z.infer<typeof TwitterUserInsertSchema>;
export const TwitterUserUpdateSchema = createUpdateSchema(twitterUsers);
export type TwitterUserUpdate = z.infer<typeof TwitterUserUpdateSchema>;

export const twitterUsersRelations = relations(twitterUsers, ({ many, one }) => ({
	tweets: many(twitterTweets),
	integrationRun: one(integrationRuns, {
		fields: [twitterUsers.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indices, {
		relationName: 'indexEntry',
		fields: [twitterUsers.indexEntryId],
		references: [indices.id],
	}),
}));

export const twitterIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	tweets: many(twitterTweets),
	users: many(twitterUsers),
}));
