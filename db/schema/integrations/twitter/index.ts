import { text, integer, index, foreignKey, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '../schema';
import { contentTimestamps, databaseTimestamps } from '../../operations/common';
import { indexEntries, media, records } from '../../main';

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
		username: text('username'),
		displayName: text('display_name'),
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
		indexEntryId: integer('index_entry_id').references(() => indexEntries.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [index().on(table.archivedAt), index().on(table.indexEntryId)]
);

export const twitterUsersRelations = relations(twitterUsers, ({ many, one }) => ({
	tweets: many(twitterTweets),
	integrationRun: one(integrationRuns, {
		fields: [twitterUsers.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indexEntries, {
		fields: [twitterUsers.indexEntryId],
		references: [indexEntries.id],
	}),
}));

export type TwitterTweet = typeof twitterTweets.$inferSelect;
export type NewTwitterTweet = typeof twitterTweets.$inferInsert;
export type TwitterMedia = typeof twitterMedia.$inferSelect;
export type NewTwitterMedia = typeof twitterMedia.$inferInsert;
export type TwitterUser = typeof twitterUsers.$inferSelect;
export type NewTwitterUser = typeof twitterUsers.$inferInsert;
