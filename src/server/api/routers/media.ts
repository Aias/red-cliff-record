import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { media, MediaInsertSchema, MediaUpdateSchema } from '~/server/db/schema/main';
import { createTRPCRouter, publicProcedure } from '../init';
import { SIMILARITY_THRESHOLD } from './common';

export const mediaRouter = createTRPCRouter({
	get: publicProcedure.input(z.number().int().positive()).query(async ({ ctx: { db }, input }) => {
		const mediaItem = await db.query.media.findFirst({
			where: eq(media.id, input),
		});
		if (!mediaItem) {
			throw new Error('Media not found');
		}
		return mediaItem;
	}),

	create: publicProcedure.input(MediaInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const {
			size: fileSize,
			mimeType,
			mediaFormat: format,
			width,
			height,
		} = await getSmartMetadata(input.url);
		console.log(
			`Metadata: ${JSON.stringify({ fileSize, mimeType, format, width, height }, null, 2)}`
		);
		// TODO: Fix mimetype/format - returning application for images.

		const newData = {
			...input,
			fileSize,
			mimeType,
			format,
			width,
			height,
		};
		const [newMedia] = await db
			.insert(media)
			.values(newData)
			.onConflictDoUpdate({
				target: [media.url],
				set: { ...newData, updatedAt: new Date() },
			})
			.returning();
		if (!newMedia) {
			throw new Error('Failed to create media');
		}
		return newMedia;
	}),

	update: publicProcedure
		.input(MediaUpdateSchema.extend({ id: z.number().int().positive() }))
		.mutation(async ({ ctx: { db }, input }) => {
			const { id, ...updateData } = input;
			const [updatedMedia] = await db
				.update(media)
				.set({ ...updateData, updatedAt: new Date() })
				.where(eq(media.id, id))
				.returning();
			if (!updatedMedia) {
				throw new Error('Failed to update media');
			}
			return updatedMedia;
		}),

	delete: publicProcedure
		.input(z.number().int().positive())
		.mutation(async ({ ctx: { db }, input }) => {
			const [deletedMedia] = await db.delete(media).where(eq(media.id, input)).returning();
			return deletedMedia;
		}),

	search: publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
		return db.query.media.findMany({
			where: sql`(
				${media.title} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
				${media.altText} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
				${media.url} <-> ${input} < ${SIMILARITY_THRESHOLD}
			)`,
			limit: 10,
			orderBy: [
				sql`LEAST(
					${media.title} <-> ${input},
					${media.altText} <-> ${input},
					${media.url} <-> ${input}
				)`,
				desc(media.updatedAt),
			],
		});
	}),
});
