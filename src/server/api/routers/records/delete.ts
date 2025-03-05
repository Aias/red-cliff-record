import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { IdSchema } from '../records.types';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtracts,
	airtableFormats,
	airtableSpaces,
	githubRepositories,
	githubUsers,
	lightroomImages,
	raindropBookmarks,
	raindropCollections,
	raindropImages,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseTags,
	records,
	twitterMedia,
	twitterTweets,
	twitterUsers,
} from '@/db/schema';

export const deleteRecords = publicProcedure
	.input(z.array(IdSchema))
	.mutation(async ({ ctx: { db }, input }) => {
		const recordsToDelete = await db.query.records.findMany({
			where: (records, { inArray }) => inArray(records.id, input),
			with: {
				media: true,
			},
		});
		const linkedMediaIds = recordsToDelete.flatMap((r) => r.media.map((m) => m.id));

		if (recordsToDelete.length !== input.length) {
			const notFound = input.filter((id) => !recordsToDelete.some((r) => r.id === id));
			console.warn(`Some records were not found: ${notFound.join(', ')}`);
		}

		try {
			const deletedRecords = await db.transaction(async (tx) => {
				const now = new Date();

				// Update all associated tables with a soft delete. For each table with a recordId field, set deletedAt to now

				// Airtable
				await tx
					.update(airtableCreators)
					.set({ deletedAt: now })
					.where(inArray(airtableCreators.recordId, input));

				await tx
					.update(airtableExtracts)
					.set({ deletedAt: now })
					.where(inArray(airtableExtracts.recordId, input));

				await tx
					.update(airtableFormats)
					.set({ deletedAt: now })
					.where(inArray(airtableFormats.recordId, input));

				await tx
					.update(airtableSpaces)
					.set({ deletedAt: now })
					.where(inArray(airtableSpaces.recordId, input));

				await tx
					.update(airtableAttachments)
					.set({ deletedAt: now })
					.where(inArray(airtableAttachments.mediaId, linkedMediaIds));

				// Github
				await tx
					.update(githubRepositories)
					.set({ deletedAt: now })
					.where(inArray(githubRepositories.recordId, input));

				await tx
					.update(githubUsers)
					.set({ deletedAt: now })
					.where(inArray(githubUsers.recordId, input));

				// Lightroom
				await tx
					.update(lightroomImages)
					.set({ deletedAt: now })
					.where(inArray(lightroomImages.recordId, input));

				// Raindrop
				await tx
					.update(raindropBookmarks)
					.set({ deletedAt: now })
					.where(inArray(raindropBookmarks.recordId, input));

				await tx
					.update(raindropCollections)
					.set({ deletedAt: now })
					.where(inArray(raindropCollections.recordId, input));

				await tx
					.update(raindropTags)
					.set({ deletedAt: now })
					.where(inArray(raindropTags.recordId, input));

				await tx
					.update(raindropImages)
					.set({ deletedAt: now })
					.where(inArray(raindropImages.mediaId, linkedMediaIds));

				// Readwise
				await tx
					.update(readwiseAuthors)
					.set({ deletedAt: now })
					.where(inArray(readwiseAuthors.recordId, input));

				await tx
					.update(readwiseDocuments)
					.set({ deletedAt: now })
					.where(inArray(readwiseDocuments.recordId, input));

				await tx
					.update(readwiseTags)
					.set({ deletedAt: now })
					.where(inArray(readwiseTags.recordId, input));

				// Twitter
				await tx
					.update(twitterTweets)
					.set({ deletedAt: now })
					.where(inArray(twitterTweets.recordId, input));

				await tx
					.update(twitterUsers)
					.set({ deletedAt: now })
					.where(inArray(twitterUsers.recordId, input));

				await tx
					.update(twitterMedia)
					.set({ deletedAt: now })
					.where(inArray(twitterMedia.mediaId, linkedMediaIds));

				// Delete the main records
				const deletedRecords = await tx
					.delete(records)
					.where(inArray(records.id, input))
					.returning();

				return deletedRecords;
			});

			return deletedRecords;
		} catch (error) {
			console.error(error);
			throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete records' });
		}
	});
