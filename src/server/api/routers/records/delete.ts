import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';
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
				const deletedAirtableCreators = await tx
					.update(airtableCreators)
					.set({ deletedAt: now })
					.where(inArray(airtableCreators.recordId, input))
					.returning();
				for (const creator of deletedAirtableCreators) {
					console.log(`Deleted Airtable creator ${creator.name} (${creator.id})`);
				}

				const deletedAirtableExtracts = await tx
					.update(airtableExtracts)
					.set({ deletedAt: now })
					.where(inArray(airtableExtracts.recordId, input))
					.returning();
				for (const extract of deletedAirtableExtracts) {
					console.log(`Deleted Airtable extract ${extract.title} (${extract.id})`);
				}

				const deletedAirtableFormats = await tx
					.update(airtableFormats)
					.set({ deletedAt: now })
					.where(inArray(airtableFormats.recordId, input))
					.returning();
				for (const format of deletedAirtableFormats) {
					console.log(`Deleted Airtable format ${format.name} (${format.id})`);
				}

				const deletedAirtableSpaces = await tx
					.update(airtableSpaces)
					.set({ deletedAt: now })
					.where(inArray(airtableSpaces.recordId, input))
					.returning();
				for (const space of deletedAirtableSpaces) {
					console.log(`Deleted Airtable space ${space.name} (${space.id})`);
				}

				const deletedAirtableAttachments = await tx
					.update(airtableAttachments)
					.set({ deletedAt: now })
					.where(inArray(airtableAttachments.mediaId, linkedMediaIds))
					.returning();
				for (const attachment of deletedAirtableAttachments) {
					console.log(`Deleted Airtable attachment ${attachment.filename} (${attachment.id})`);
				}

				// Github
				const deletedGithubRepositories = await tx
					.update(githubRepositories)
					.set({ deletedAt: now })
					.where(inArray(githubRepositories.recordId, input))
					.returning();
				for (const repo of deletedGithubRepositories) {
					console.log(`Deleted Github repository ${repo.name} (${repo.id})`);
				}

				const deletedGithubUsers = await tx
					.update(githubUsers)
					.set({ deletedAt: now })
					.where(inArray(githubUsers.recordId, input))
					.returning();
				for (const user of deletedGithubUsers) {
					console.log(`Deleted Github user ${user.login} (${user.id})`);
				}

				// Lightroom
				const deletedLightroomImages = await tx
					.update(lightroomImages)
					.set({ deletedAt: now, mediaId: null })
					.where(inArray(lightroomImages.recordId, input))
					.returning();
				for (const image of deletedLightroomImages) {
					console.log(`Deleted Lightroom image ${image.fileName} (${image.id})`);
				}

				// Raindrop
				const deletedRaindropBookmarks = await tx
					.update(raindropBookmarks)
					.set({ deletedAt: now })
					.where(inArray(raindropBookmarks.recordId, input))
					.returning();
				for (const bookmark of deletedRaindropBookmarks) {
					console.log(`Deleted Raindrop bookmark ${bookmark.title} (${bookmark.id})`);
				}

				const deletedRaindropCollections = await tx
					.update(raindropCollections)
					.set({ deletedAt: now })
					.where(inArray(raindropCollections.recordId, input))
					.returning();
				for (const collection of deletedRaindropCollections) {
					console.log(`Deleted Raindrop collection ${collection.title} (${collection.id})`);
				}

				const deletedRaindropTags = await tx
					.update(raindropTags)
					.set({ deletedAt: now })
					.where(inArray(raindropTags.recordId, input))
					.returning();
				for (const tag of deletedRaindropTags) {
					console.log(`Deleted Raindrop tag ${tag.tag} (${tag.id})`);
				}

				const deletedRaindropImages = await tx
					.update(raindropImages)
					.set({ deletedAt: now })
					.where(inArray(raindropImages.mediaId, linkedMediaIds))
					.returning();
				for (const image of deletedRaindropImages) {
					console.log(`Deleted Raindrop image ${image.url} (${image.id})`);
				}

				// Readwise
				const deletedReadwiseAuthors = await tx
					.update(readwiseAuthors)
					.set({ deletedAt: now })
					.where(inArray(readwiseAuthors.recordId, input))
					.returning();
				for (const author of deletedReadwiseAuthors) {
					console.log(`Deleted Readwise author ${author.name} (${author.id})`);
				}

				const deletedReadwiseDocuments = await tx
					.update(readwiseDocuments)
					.set({ deletedAt: now })
					.where(inArray(readwiseDocuments.recordId, input))
					.returning();
				for (const document of deletedReadwiseDocuments) {
					console.log(`Deleted Readwise document ${document.title} (${document.id})`);
				}

				const deletedReadwiseTags = await tx
					.update(readwiseTags)
					.set({ deletedAt: now })
					.where(inArray(readwiseTags.recordId, input))
					.returning();
				for (const tag of deletedReadwiseTags) {
					console.log(`Deleted Readwise tag ${tag.tag} (${tag.id})`);
				}

				// Twitter
				const deletedTwitterTweets = await tx
					.update(twitterTweets)
					.set({ deletedAt: now })
					.where(inArray(twitterTweets.recordId, input))
					.returning();
				for (const tweet of deletedTwitterTweets) {
					console.log(`Deleted Twitter tweet ${tweet.text?.slice(0, 20)} (${tweet.id})`);
				}

				const deletedTwitterUsers = await tx
					.update(twitterUsers)
					.set({ deletedAt: now })
					.where(inArray(twitterUsers.recordId, input))
					.returning();
				for (const twUser of deletedTwitterUsers) {
					console.log(`Deleted Twitter user ${twUser.username} (${twUser.id})`);
				}

				const deletedTwitterMedia = await tx
					.update(twitterMedia)
					.set({ deletedAt: now })
					.where(inArray(twitterMedia.mediaId, linkedMediaIds))
					.returning();
				for (const media of deletedTwitterMedia) {
					console.log(`Deleted Twitter media ${media.mediaUrl} (${media.id})`);
				}

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
