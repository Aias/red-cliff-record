import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../init';
import { IdSchema } from './common';
import {
	airtableAttachments,
	lightroomImages,
	media,
	raindropImages,
	twitterMedia,
} from '@/db/schema';

export const mediaRouter = createTRPCRouter({
	delete: publicProcedure.input(z.array(IdSchema)).mutation(async ({ ctx: { db }, input }) => {
		const mediaToDelete = await db.query.media.findMany({
			where: {
				id: {
					in: input,
				},
			},
		});

		if (mediaToDelete.length !== input.length) {
			const notFound = input.filter((id) => !mediaToDelete.some((m) => m.id === id));
			console.warn(`Some media were not found: ${notFound.join(', ')}`);
		}

		try {
			const deletedMedia = await db.transaction(async (tx) => {
				const now = new Date();

				// Update all associated tables with a soft delete
				// For each table with a mediaId field, set deletedAt to now

				// Airtable
				const deletedAirtableAttachments = await tx
					.update(airtableAttachments)
					.set({ deletedAt: now })
					.where(inArray(airtableAttachments.mediaId, input))
					.returning();
				for (const attachment of deletedAirtableAttachments) {
					console.log(`Deleted Airtable attachment ${attachment.filename} (${attachment.id})`);
				}

				// Lightroom
				const deletedLightroomImages = await tx
					.update(lightroomImages)
					.set({ deletedAt: now })
					.where(inArray(lightroomImages.mediaId, input))
					.returning();
				for (const image of deletedLightroomImages) {
					console.log(`Deleted Lightroom image ${image.fileName} (${image.id})`);
				}

				// Raindrop
				const deletedRaindropImages = await tx
					.update(raindropImages)
					.set({ deletedAt: now })
					.where(inArray(raindropImages.mediaId, input))
					.returning();
				for (const image of deletedRaindropImages) {
					console.log(`Deleted Raindrop image ${image.url} (${image.id})`);
				}

				// Twitter
				const deletedTwitterMedia = await tx
					.update(twitterMedia)
					.set({ deletedAt: now })
					.where(inArray(twitterMedia.mediaId, input))
					.returning();
				for (const m of deletedTwitterMedia) {
					console.log(`Deleted Twitter media ${m.mediaUrl} (${m.id})`);
				}

				// Delete the main media records
				const deletedMedia = await tx.delete(media).where(inArray(media.id, input)).returning();

				return deletedMedia;
			});

			return deletedMedia;
		} catch (error) {
			console.error(error);
			throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete media' });
		}
	}),
});
