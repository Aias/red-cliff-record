import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { twitterMedia, twitterTweets, twitterUsers } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';
import { buildWhereClause, RequestParamsSchema } from './common';

export const twitterRouter = createTRPCRouter({
	getTweets: publicProcedure.input(RequestParamsSchema).query(async ({ ctx: { db }, input }) => {
		const tweets = await db.query.twitterTweets.findMany({
			with: {
				user: true,
				media: true,
				quotedTweet: true,
			},
			where: buildWhereClause(input, twitterTweets.archivedAt, twitterTweets.recordId),
			orderBy: [desc(twitterTweets.archivedAt), desc(twitterTweets.contentCreatedAt)],
			limit: input.limit,
		});

		return tweets;
	}),

	getUsers: publicProcedure.input(RequestParamsSchema).query(async ({ ctx: { db }, input }) => {
		const users = await db.query.twitterUsers.findMany({
			with: {
				tweets: true,
			},
			where: buildWhereClause(input, twitterUsers.archivedAt, twitterUsers.indexEntryId),
			orderBy: [desc(twitterUsers.archivedAt), desc(twitterUsers.contentCreatedAt)],
			limit: input.limit,
		});

		return users;
	}),

	getMedia: publicProcedure.input(RequestParamsSchema).query(async ({ ctx: { db }, input }) => {
		const media = await db.query.twitterMedia.findMany({
			with: {
				tweet: true,
			},
			where: buildWhereClause(input, twitterMedia.archivedAt, twitterMedia.mediaId),
			orderBy: [desc(twitterMedia.archivedAt), desc(twitterMedia.contentCreatedAt)],
			limit: input.limit,
		});

		return media;
	}),

	linkUserToIndexEntry: publicProcedure
		.input(z.object({ userId: z.string(), indexEntryId: z.number().int().positive() }))
		.mutation(async ({ ctx: { db }, input: { userId, indexEntryId } }) => {
			const [updatedUser] = await db
				.update(twitterUsers)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(twitterUsers.id, userId))
				.returning();
			return updatedUser;
		}),

	unlinkUsersFromIndices: publicProcedure
		.input(z.array(z.string()))
		.mutation(async ({ ctx: { db }, input: userIds }) => {
			return db
				.update(twitterUsers)
				.set({ indexEntryId: null, updatedAt: new Date() })
				.where(inArray(twitterUsers.id, userIds))
				.returning();
		}),

	setUsersArchiveStatus: publicProcedure
		.input(z.object({ userIds: z.array(z.string()), shouldArchive: z.boolean() }))
		.mutation(async ({ ctx: { db }, input: { userIds, shouldArchive } }) => {
			return db
				.update(twitterUsers)
				.set({ archivedAt: shouldArchive ? new Date() : null })
				.where(inArray(twitterUsers.id, userIds))
				.returning();
		}),
});
