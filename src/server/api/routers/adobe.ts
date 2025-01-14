import { desc, isNull } from 'drizzle-orm';
import { createTRPCRouter, publicProcedure } from '../init';
import { adobeLightroomImages } from '~/server/db/schema/integrations';

export const adobeRouter = createTRPCRouter({
	getLightroomImages: publicProcedure.query(async ({ ctx }) => {
		const lightroomImages = await ctx.db.query.adobeLightroomImages.findMany({
			where: isNull(adobeLightroomImages.mediaId),
			orderBy: [desc(adobeLightroomImages.archivedAt), desc(adobeLightroomImages.contentCreatedAt)],
			limit: 100,
		});

		return lightroomImages;
	}),
});
