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
  type RecordSelect,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { IdSchema } from '@/shared/types/api';
import { publicProcedure } from '../../init';

/** Executes a soft-delete update and logs the count of affected rows. */
async function softDelete(query: Promise<unknown[]>, label: string): Promise<number> {
  const deleted = await query;
  if (deleted.length > 0) {
    console.log(`Soft-deleted ${deleted.length} ${label}${deleted.length !== 1 ? 's' : ''}`);
  }
  return deleted.length;
}

export const deleteRecords = publicProcedure
  .input(z.array(IdSchema))
  .mutation(async ({ ctx: { db }, input }): Promise<RecordSelect[]> => {
    const recordsToDelete = await db.query.records.findMany({
      where: { id: { in: input } },
      with: { media: true },
    });
    const linkedMediaIds = recordsToDelete.flatMap((r) => r.media.map((m) => m.id));

    if (recordsToDelete.length !== input.length) {
      const notFound = input.filter((id) => !recordsToDelete.some((r) => r.id === id));
      console.warn(`Some records were not found: ${notFound.join(', ')}`);
    }

    try {
      const now = new Date();

      // Soft-delete all associated integration rows

      // Airtable
      await softDelete(
        db
          .update(airtableCreators)
          .set({ deletedAt: now })
          .where(inArray(airtableCreators.recordId, input))
          .returning(),
        'airtable creator'
      );
      await softDelete(
        db
          .update(airtableExtracts)
          .set({ deletedAt: now })
          .where(inArray(airtableExtracts.recordId, input))
          .returning(),
        'airtable extract'
      );
      await softDelete(
        db
          .update(airtableFormats)
          .set({ deletedAt: now })
          .where(inArray(airtableFormats.recordId, input))
          .returning(),
        'airtable format'
      );
      await softDelete(
        db
          .update(airtableSpaces)
          .set({ deletedAt: now })
          .where(inArray(airtableSpaces.recordId, input))
          .returning(),
        'airtable space'
      );
      await softDelete(
        db
          .update(airtableAttachments)
          .set({ deletedAt: now })
          .where(inArray(airtableAttachments.mediaId, linkedMediaIds))
          .returning(),
        'airtable attachment'
      );

      // GitHub
      await softDelete(
        db
          .update(githubRepositories)
          .set({ deletedAt: now })
          .where(inArray(githubRepositories.recordId, input))
          .returning(),
        'github repository'
      );
      await softDelete(
        db
          .update(githubUsers)
          .set({ deletedAt: now })
          .where(inArray(githubUsers.recordId, input))
          .returning(),
        'github user'
      );

      // Lightroom
      await softDelete(
        db
          .update(lightroomImages)
          .set({ deletedAt: now, mediaId: null })
          .where(inArray(lightroomImages.recordId, input))
          .returning(),
        'lightroom image'
      );

      // Raindrop
      await softDelete(
        db
          .update(raindropBookmarks)
          .set({ deletedAt: now })
          .where(inArray(raindropBookmarks.recordId, input))
          .returning(),
        'raindrop bookmark'
      );
      await softDelete(
        db
          .update(raindropCollections)
          .set({ deletedAt: now })
          .where(inArray(raindropCollections.recordId, input))
          .returning(),
        'raindrop collection'
      );
      await softDelete(
        db
          .update(raindropTags)
          .set({ deletedAt: now })
          .where(inArray(raindropTags.recordId, input))
          .returning(),
        'raindrop tag'
      );
      await softDelete(
        db
          .update(raindropImages)
          .set({ deletedAt: now })
          .where(inArray(raindropImages.mediaId, linkedMediaIds))
          .returning(),
        'raindrop image'
      );

      // Readwise
      await softDelete(
        db
          .update(readwiseAuthors)
          .set({ deletedAt: now })
          .where(inArray(readwiseAuthors.recordId, input))
          .returning(),
        'readwise author'
      );
      await softDelete(
        db
          .update(readwiseDocuments)
          .set({ deletedAt: now })
          .where(inArray(readwiseDocuments.recordId, input))
          .returning(),
        'readwise document'
      );
      await softDelete(
        db
          .update(readwiseTags)
          .set({ deletedAt: now })
          .where(inArray(readwiseTags.recordId, input))
          .returning(),
        'readwise tag'
      );

      // Twitter
      await softDelete(
        db
          .update(twitterTweets)
          .set({ deletedAt: now })
          .where(inArray(twitterTweets.recordId, input))
          .returning(),
        'twitter tweet'
      );
      await softDelete(
        db
          .update(twitterUsers)
          .set({ deletedAt: now })
          .where(inArray(twitterUsers.recordId, input))
          .returning(),
        'twitter user'
      );
      await softDelete(
        db
          .update(twitterMedia)
          .set({ deletedAt: now })
          .where(inArray(twitterMedia.mediaId, linkedMediaIds))
          .returning(),
        'twitter media'
      );

      // Delete the main records
      return await db.delete(records).where(inArray(records.id, input)).returning();
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete records',
        cause: error,
      });
    }
  });
