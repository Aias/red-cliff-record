import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const twitterTweets = pgTable(
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
		inReplyToTweetId: text('in_reply_to_tweet_id').references((): AnyPgColumn => twitterTweets.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		conversationId: text('conversation_id'),
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
		index().on(table.integrationRunId),
		index().on(table.recordId),
		index().on(table.userId),
		index().on(table.deletedAt),
	]
);

export const TwitterTweetSelectSchema = createSelectSchema(twitterTweets);
export type TwitterTweetSelect = typeof twitterTweets.$inferSelect;
export const TwitterTweetInsertSchema = createInsertSchema(twitterTweets);
export type TwitterTweetInsert = typeof twitterTweets.$inferInsert;

export const twitterMediaTypeEnum = pgEnum('twitter_media_type', [
	'photo',
	'video',
	'animated_gif',
]);
export const TwitterMediaType = z.enum(twitterMediaTypeEnum.enumValues);
export type TwitterMediaType = z.infer<typeof TwitterMediaType>;

export const twitterMedia = pgTable(
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
		mediaId: integer('media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.tweetId), index().on(table.mediaId)]
);

export const TwitterMediaSelectSchema = createSelectSchema(twitterMedia);
export type TwitterMediaSelect = typeof twitterMedia.$inferSelect;
export const TwitterMediaInsertSchema = createInsertSchema(twitterMedia);
export type TwitterMediaInsert = typeof twitterMedia.$inferInsert;

export const twitterUsers = pgTable(
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
	(table) => [index().on(table.recordId), index().on(table.deletedAt)]
);

export const TwitterUserSelectSchema = createSelectSchema(twitterUsers);
export type TwitterUserSelect = typeof twitterUsers.$inferSelect;
export const TwitterUserInsertSchema = createInsertSchema(twitterUsers);
export type TwitterUserInsert = typeof twitterUsers.$inferInsert;
