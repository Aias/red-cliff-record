import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { media, MediaInsertSchema, type MediaInsert } from '~/server/db/schema/media';
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
		const { size, mediaType, mediaFormat, contentTypeString, width, height } =
			await getSmartMetadata(input.url);
		console.log(
			`Metadata: ${JSON.stringify({ size, mediaType, mediaFormat, contentTypeString, width, height }, null, 2)}`
		);

		const newData: MediaInsert = {
			...input,
			fileSize: size,
			type: mediaType,
			format: mediaFormat,
			contentTypeString: contentTypeString,
			width,
			height,
		};

		const [newMedia] = await db
			.insert(media)
			.values(newData)
			.onConflictDoUpdate({
				target: [media.url],
				set: { ...newData, recordUpdatedAt: new Date() },
			})
			.returning();

		if (!newMedia) {
			throw new Error('Failed to create media');
		}
		return newMedia;
	}),

	update: publicProcedure
		.input(MediaInsertSchema.partial().extend({ id: z.number().int().positive() }))
		.mutation(async ({ ctx: { db }, input }) => {
			const { id, ...updateData } = input;
			const [updatedMedia] = await db
				.update(media)
				.set({ ...updateData, recordUpdatedAt: new Date() })
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
				(${media.altText} IS NOT NULL AND ${media.altText} <-> ${input} < ${SIMILARITY_THRESHOLD}) OR
				(${media.url} IS NOT NULL AND ${media.url} <-> ${input} < ${SIMILARITY_THRESHOLD})
			)`,
			limit: 10,
			orderBy: [
				sql`LEAST(
					(CASE WHEN ${media.altText} IS NOT NULL THEN ${media.altText} <-> ${input} ELSE 9999 END),
					(CASE WHEN ${media.url} IS NOT NULL THEN ${media.url} <-> ${input} ELSE 9999 END)
				)`,
				desc(media.recordUpdatedAt),
			],
		});
	}),
});
