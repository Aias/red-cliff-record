import { desc, isNull } from 'drizzle-orm';
import { raindropBookmarks, raindropCollections } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';

export const raindropRouter = createTRPCRouter({
	getCollections: publicProcedure.query(async ({ ctx }) => {
		const collections = await ctx.db.query.raindropCollections.findMany({
			with: {
				parent: true,
				children: true,
			},
			where: isNull(raindropCollections.indexEntryId),
			orderBy: [desc(raindropCollections.archivedAt), desc(raindropCollections.contentCreatedAt)],
			limit: 100,
		});

		return collections;
	}),

	getBookmarks: publicProcedure.query(async ({ ctx }) => {
		const bookmarks = await ctx.db.query.raindropBookmarks.findMany({
			with: {
				collection: true,
			},
			where: isNull(raindropBookmarks.recordId),
			orderBy: [desc(raindropBookmarks.archivedAt), desc(raindropBookmarks.contentCreatedAt)],
			limit: 100,
		});

		return bookmarks;
	}),
});
