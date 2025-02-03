import { relations } from 'drizzle-orm';
import { index, integer, text, timestamp, vector, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { contentTimestamps, databaseTimestamps } from '../common';
import { indices, records } from '../main';
import { media } from '../main/media';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

export const twitterTweets = integrationSchema.table(
	'twitter_tweets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => twitterUsers.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			}),
		text: text('text'),
		quotedTweetId: text('quoted_tweet_id').references((): AnyPgColumn => twitterTweets.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
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
		index().on(table.archivedAt),
		index().on(table.recordId),
	]
);

export const TwitterTweetSelectSchema = createSelectSchema(twitterTweets);
export type TwitterTweetSelect = typeof twitterTweets.$inferSelect;
export const TwitterTweetInsertSchema = createInsertSchema(twitterTweets);
export type TwitterTweetInsert = typeof twitterTweets.$inferInsert;

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

export const TwitterMediaType = z.enum(['photo', 'video', 'animated_gif']);
export type TwitterMediaType = z.infer<typeof TwitterMediaType>;

export const twitterMediaTypeEnum = integrationSchema.enum(
	'twitter_media_type',
	TwitterMediaType.options
);

export const twitterMedia = integrationSchema.table(
	'twitter_media',
	{
		id: text('id').primaryKey(),
		type: twitterMediaTypeEnum('type').notNull(),
		tweetUrl: text('tweet_url').notNull(),
		mediaUrl: text('media_url').notNull().unique(),
		thumbnailUrl: text('thumbnail_url').unique(),
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
export type TwitterMediaSelect = typeof twitterMedia.$inferSelect;
export const TwitterMediaInsertSchema = createInsertSchema(twitterMedia);
export type TwitterMediaInsert = typeof twitterMedia.$inferInsert;

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
export type TwitterUserSelect = typeof twitterUsers.$inferSelect;
export const TwitterUserInsertSchema = createInsertSchema(twitterUsers);
export type TwitterUserInsert = typeof twitterUsers.$inferInsert;

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
