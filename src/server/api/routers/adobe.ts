import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { adobeLightroomImages } from '~/server/db/schema/adobe';
import { createTRPCRouter, publicProcedure } from '../init';
import { buildWhereClause, RequestParamsSchema } from './common';

export const adobeRouter = createTRPCRouter({
	getLightroomImages: publicProcedure.input(RequestParamsSchema).query(async ({ ctx, input }) => {
		const lightroomImages = await ctx.db.query.adobeLightroomImages.findMany({
			where: buildWhereClause(input, adobeLightroomImages.archivedAt, adobeLightroomImages.mediaId),
			orderBy: [desc(adobeLightroomImages.archivedAt), adobeLightroomImages.captureDate],
			limit: input.limit,
		});

		return lightroomImages;
	}),

	linkMedia: publicProcedure
		.input(
			z.object({
				lightroomImageId: z.string(),
				mediaId: z.number().int().positive(),
			})
		)
		.mutation(async ({ ctx: { db }, input: { lightroomImageId, mediaId } }) => {
			const [updatedImage] = await db
				.update(adobeLightroomImages)
				.set({ mediaId, recordUpdatedAt: new Date() })
				.where(eq(adobeLightroomImages.id, lightroomImageId))
				.returning();
			return updatedImage;
		}),

	unlinkMedia: publicProcedure
		.input(z.array(z.string()))
		.mutation(async ({ ctx: { db }, input: imageIds }) => {
			return db
				.update(adobeLightroomImages)
				.set({ mediaId: null, recordUpdatedAt: new Date() })
				.where(inArray(adobeLightroomImages.id, imageIds))
				.returning();
		}),

	setLightroomImageArchiveStatus: publicProcedure
		.input(
			z.object({
				lightroomImageIds: z.array(z.string()),
				shouldArchive: z.boolean(),
			})
		)
		.mutation(async ({ ctx: { db }, input: { lightroomImageIds, shouldArchive } }) => {
			return db
				.update(adobeLightroomImages)
				.set({
					archivedAt: shouldArchive ? new Date() : null,
					recordUpdatedAt: new Date(),
				})
				.where(inArray(adobeLightroomImages.id, lightroomImageIds))
				.returning();
		}),
});
