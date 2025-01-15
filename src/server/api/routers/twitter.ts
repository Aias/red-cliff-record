import { desc, isNull } from 'drizzle-orm';
import { twitterMedia, twitterTweets, twitterUsers } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';
import { DEFAULT_LIMIT } from './common';

export const twitterRouter = createTRPCRouter({
	getTweets: publicProcedure.query(async ({ ctx }) => {
		const tweets = await ctx.db.query.twitterTweets.findMany({
			with: {
				user: true,
				media: true,
				quotedTweet: true,
			},
			where: isNull(twitterTweets.recordId),
			orderBy: [desc(twitterTweets.archivedAt), desc(twitterTweets.contentCreatedAt)],
			limit: DEFAULT_LIMIT,
		});

		return tweets;
	}),

	getUsers: publicProcedure.query(async ({ ctx }) => {
		const users = await ctx.db.query.twitterUsers.findMany({
			with: {
				tweets: true,
			},
			where: isNull(twitterUsers.indexEntryId),
			orderBy: [desc(twitterUsers.archivedAt), desc(twitterUsers.contentCreatedAt)],
			limit: DEFAULT_LIMIT,
		});

		return users;
	}),

	getMedia: publicProcedure.query(async ({ ctx }) => {
		const media = await ctx.db.query.twitterMedia.findMany({
			with: {
				tweet: true,
			},
			where: isNull(twitterMedia.mediaId),
			orderBy: [desc(twitterMedia.archivedAt), desc(twitterMedia.contentCreatedAt)],
			limit: DEFAULT_LIMIT,
		});

		return media;
	}),
});
