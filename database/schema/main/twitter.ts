import { pgSchema, text, timestamp, integer, index, unique, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { integrationRuns } from './integrations';
import { timestamps } from '@schema/common/timestamps';

export const twitterSchema = pgSchema('twitter');

export const tweets = twitterSchema.table(
	'tweets',
	{
		id: text().primaryKey(),
		userId: text()
			.references(() => users.id)
			.notNull(),
		text: text(),
		quotedTweetId: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		postedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		foreignKey({
			columns: [table.quotedTweetId],
			foreignColumns: [table.id]
		})
	]
);

export const tweetsRelations = relations(tweets, ({ one, many }) => ({
	media: many(media),
	user: one(users, {
		fields: [tweets.userId],
		references: [users.id]
	}),
	quotedTweet: one(tweets, {
		fields: [tweets.quotedTweetId],
		references: [tweets.id],
		relationName: 'quotedTweet'
	}),
	integrationRun: one(integrationRuns, {
		fields: [tweets.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const media = twitterSchema.table('media', {
	id: text().primaryKey(),
	type: text(),
	url: text(),
	mediaUrl: text(),
	tweetId: text()
		.references(() => tweets.id)
		.notNull(),
	...timestamps
});

export const mediaRelations = relations(media, ({ one }) => ({
	tweet: one(tweets, {
		fields: [media.tweetId],
		references: [tweets.id]
	})
}));

export const users = twitterSchema.table('users', {
	id: text().primaryKey(),
	username: text(),
	displayName: text(),
	description: text(),
	location: text(),
	url: text(),
	externalUrl: text(),
	profileImageUrl: text(),
	profileBannerUrl: text(),
	...timestamps
});

export const usersRelations = relations(users, ({ many }) => ({
	tweets: many(tweets)
}));
