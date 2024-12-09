import { text, integer, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { integrationRuns } from '../../operations/schema';
import { integrationSchema } from '..';
import { contentTimestamps, databaseTimestamps } from '../../operations/common';

export const twitterTweets = integrationSchema.table(
	'twitter_tweets',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.references(() => twitterUsers.id)
			.notNull(),
		text: text('text'),
		quotedTweetId: text('quoted_tweet_id'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.integrationRunId),
		foreignKey({
			columns: [table.quotedTweetId],
			foreignColumns: [table.id],
		}),
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
}));

export const twitterMedia = integrationSchema.table('twitter_media', {
	id: text('id').primaryKey(),
	type: text('type'),
	url: text('url'),
	mediaUrl: text('media_url'),
	tweetId: text('tweet_id')
		.references(() => twitterTweets.id)
		.notNull(),
	...contentTimestamps,
	...databaseTimestamps,
});

export const twitterMediaRelations = relations(twitterMedia, ({ one }) => ({
	tweet: one(twitterTweets, {
		fields: [twitterMedia.tweetId],
		references: [twitterTweets.id],
		relationName: 'tweetMedia',
	}),
}));

export const twitterUsers = integrationSchema.table('twitter_users', {
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
});

export const twitterUsersRelations = relations(twitterUsers, ({ many, one }) => ({
	tweets: many(twitterTweets),
	integrationRun: one(integrationRuns, {
		fields: [twitterUsers.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export type TwitterTweet = typeof twitterTweets.$inferSelect;
export type NewTwitterTweet = typeof twitterTweets.$inferInsert;
export type TwitterMedia = typeof twitterMedia.$inferSelect;
export type NewTwitterMedia = typeof twitterMedia.$inferInsert;
export type TwitterUser = typeof twitterUsers.$inferSelect;
export type NewTwitterUser = typeof twitterUsers.$inferInsert;
