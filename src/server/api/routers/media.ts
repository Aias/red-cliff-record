import {
	airtableAttachments,
	lightroomImages,
	media,
	raindropImages,
	twitterMedia,
} from '@rcr/data';
import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { getMediaInsertData, uploadClientFileToR2 } from '@/server/lib/media';
import { createTRPCRouter, publicProcedure } from '../init';
import { IdSchema } from '@/shared/types';

// Schema for file upload input
const MediaCreateInputSchema = z.object({
	recordId: IdSchema,
	fileData: z.string(), // Expecting base64 encoded string
	fileName: z.string(),
	fileType: z.string(), // e.g., 'image/png'
});

export const mediaRouter = createTRPCRouter({
	create: publicProcedure.input(MediaCreateInputSchema).mutation(async ({ ctx: { db }, input }) => {
		try {
			// 1. Decode base64 file data
			const fileBuffer = Buffer.from(input.fileData, 'base64');

			// 2. Upload file to R2
			const r2Url = await uploadClientFileToR2(fileBuffer, input.fileType, input.fileName);

			// 3. Get metadata for the uploaded file using its R2 URL
			const mediaInsertData = await getMediaInsertData(r2Url, {
				recordId: input.recordId,
			});

			if (!mediaInsertData) {
				console.error('Failed to get media metadata after upload.');
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to get media metadata after upload.',
				});
			}

			// 4. Insert media record into the database
			const [newMedia] = await db.insert(media).values(mediaInsertData).returning();

			if (!newMedia) {
				console.error('Failed to insert media record into database.');
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to insert media record into database.',
				});
			}

			return newMedia;
		} catch (error) {
			// Log the specific error before wrapping it
			console.error('Caught error during media creation:', error);
			if (error instanceof TRPCError) {
				throw error;
			}
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Failed to create media: ${error instanceof Error ? error.message : 'Unknown error'}`,
			});
		}
	}),

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
			const now = new Date();

			// Update all associated tables with a soft delete
			// For each table with a mediaId field, set deletedAt to now

			// Airtable
			const deletedAirtableAttachments = await db
				.update(airtableAttachments)
				.set({ deletedAt: now })
				.where(inArray(airtableAttachments.mediaId, input))
				.returning();
			for (const attachment of deletedAirtableAttachments) {
				console.log(`Deleted Airtable attachment ${attachment.filename} (${attachment.id})`);
			}

			// Lightroom
			const deletedLightroomImages = await db
				.update(lightroomImages)
				.set({ deletedAt: now })
				.where(inArray(lightroomImages.mediaId, input))
				.returning();
			for (const image of deletedLightroomImages) {
				console.log(`Deleted Lightroom image ${image.fileName} (${image.id})`);
			}

			// Raindrop
			const deletedRaindropImages = await db
				.update(raindropImages)
				.set({ deletedAt: now })
				.where(inArray(raindropImages.mediaId, input))
				.returning();
			for (const image of deletedRaindropImages) {
				console.log(`Deleted Raindrop image ${image.url} (${image.id})`);
			}

			// Twitter
			const deletedTwitterMedia = await db
				.update(twitterMedia)
				.set({ deletedAt: now })
				.where(inArray(twitterMedia.mediaId, input))
				.returning();
			for (const m of deletedTwitterMedia) {
				console.log(`Deleted Twitter media ${m.mediaUrl} (${m.id})`);
			}

			// Delete the main media records
			const deletedMedia = await db.delete(media).where(inArray(media.id, input)).returning();

			return deletedMedia;
		} catch (error) {
			console.error('Failed to delete media:', error);
			throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete media' });
		}
	}),
});
