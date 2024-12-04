import { pgSchema, text, timestamp, integer, index, unique, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { integrationRuns } from './integrations';
import { timestamps } from './common';

export const twitterSchema = pgSchema('twitter');

export const tweets = twitterSchema.table(
	'tweets',
	{
		id: text().primaryKey(),
		userId: text()
			.references(() => twitterUsers.id)
			.notNull(),
		text: text(),
		quotedTweetId: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		postedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		...timestamps,
	},
	(table) => [
		index().on(table.integrationRunId),
		foreignKey({
			columns: [table.quotedTweetId],
			foreignColumns: [table.id],
		}),
	]
);

export const tweetsRelations = relations(tweets, ({ one, many }) => ({
	media: many(twitterMedia, { relationName: 'tweetMedia' }),
	user: one(twitterUsers, {
		fields: [tweets.userId],
		references: [twitterUsers.id],
	}),
	quotedTweet: one(tweets, {
		fields: [tweets.quotedTweetId],
		references: [tweets.id],
		relationName: 'quotedTweet',
	}),
	integrationRun: one(integrationRuns, {
		fields: [tweets.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export const twitterMedia = twitterSchema.table('twitter_media', {
	id: text().primaryKey(),
	type: text(),
	url: text(),
	mediaUrl: text(),
	tweetId: text()
		.references(() => tweets.id)
		.notNull(),
	...timestamps,
});

export const twitterMediaRelations = relations(twitterMedia, ({ one }) => ({
	tweet: one(tweets, {
		fields: [twitterMedia.tweetId],
		references: [tweets.id],
		relationName: 'tweetMedia',
	}),
}));

export const twitterUsers = twitterSchema.table('twitter_users', {
	id: text().primaryKey(),
	username: text(),
	displayName: text(),
	description: text(),
	location: text(),
	url: text(),
	externalUrl: text(),
	profileImageUrl: text(),
	profileBannerUrl: text(),
	...timestamps,
});

export const twitterUsersRelations = relations(twitterUsers, ({ many }) => ({
	tweets: many(tweets),
}));
