import { desc, isNull } from 'drizzle-orm';
import { adobeLightroomImages } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';
import { DEFAULT_LIMIT } from './common';

export const adobeRouter = createTRPCRouter({
	getLightroomImages: publicProcedure.query(async ({ ctx }) => {
		const lightroomImages = await ctx.db.query.adobeLightroomImages.findMany({
			where: isNull(adobeLightroomImages.mediaId),
			orderBy: [desc(adobeLightroomImages.archivedAt), desc(adobeLightroomImages.contentCreatedAt)],
			limit: DEFAULT_LIMIT,
		});

		return lightroomImages;
	}),
});
