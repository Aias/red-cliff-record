import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod/v4';
import { publicProcedure } from '../../init';
import type { DbId } from '../common';
import {
	airtableCreators,
	airtableExtracts,
	airtableFormats,
	airtableSpaces,
	githubRepositories,
	githubUsers,
	lightroomImages,
	links,
	media,
	raindropBookmarks,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseTags,
	records,
	twitterTweets,
	twitterUsers,
} from '@/db/schema';
import type { LinkInsert, LinkSelect, RecordSelect } from '@/db/schema';

export const merge = publicProcedure
	.input(
		z.object({
			sourceId: z.number().int().positive(),
			targetId: z.number().int().positive(),
		})
	)
	.mutation(
		async ({
			ctx: { db },
			input,
		}): Promise<{ updatedRecord: RecordSelect; deletedRecordId: DbId; touchedIds: DbId[] }> => {
			const { sourceId, targetId } = input;
			const ids = [sourceId, targetId];

			try {
				if (sourceId === targetId) {
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Merge records: Source and target records must be different.',
					});
				}

				const [source, target] = await Promise.all([
					db.query.records.findFirst({
						where: {
							id: sourceId,
						},
					}),
					db.query.records.findFirst({
						where: {
							id: targetId,
						},
					}),
				]);

				if (!source || !target) {
					throw new TRPCError({
						code: 'NOT_FOUND',
						message: 'Merge records: One or both records not found',
					});
				}

				// Deduplicate the sources array
				const allSources = Array.from(
					new Set([...(source.sources ?? []), ...(target.sources ?? [])])
				);

				// Helper function to merge text fields
				const mergeTextFields = (
					sourceText: string | null,
					targetText: string | null
				): string | null => {
					const hasSourceText = sourceText && sourceText !== '';
					const hasTargetText = targetText && targetText !== '';

					if (hasSourceText && hasTargetText) {
						// Prefer target text first in merged content
						return `${targetText}\n---\n${sourceText}`;
					} else if (hasTargetText) {
						return targetText;
					} else if (hasSourceText) {
						return sourceText;
					}
					return null;
				};

				// Merge record data, preferring target's non-null (and non-empty string) values
				// but concatenating summary, content, and notes fields
				const mergedRecordData = {
					...source,
					...Object.fromEntries(
						Object.entries(target).filter(([key, value]) => {
							// Skip fields handled separately or automatically
							if (
								[
									'id',
									'summary',
									'content',
									'notes',
									'sources',
									'rating',
									'isPrivate',
									'isCurated',
									'recordUpdatedAt',
									'textEmbedding',
								].includes(key)
							) {
								return false;
							}
							// Keep target's value if it's not null or empty string
							return !(value === null || value === '');
						})
					),
					// Merge text fields
					summary: mergeTextFields(source.summary, target.summary),
					content: mergeTextFields(source.content, target.content),
					notes: mergeTextFields(source.notes, target.notes),
					sources: allSources.length > 0 ? allSources : null,
					rating: Math.max(source.rating, target.rating),
					isPrivate: source.isPrivate || target.isPrivate,
					isCurated: source.isCurated || target.isCurated,
					recordUpdatedAt: new Date(),
					textEmbedding: null, // Changes require recalculating the embedding
				};

				// Remove id from the update payload
				const { id: _sourceId, ...updatePayload } = mergedRecordData;

				try {
					// If the source record has a slug, nullify it first to avoid unique constraint conflict
					if (source.slug) {
						await db.update(records).set({ slug: null }).where(eq(records.id, sourceId));
					}

					// Update the target record with the merged data
					const [updatedRecord] = await db
						.update(records)
						.set(updatePayload)
						.where(eq(records.id, targetId))
						.returning();

					if (!updatedRecord) {
						throw new TRPCError({
							code: 'INTERNAL_SERVER_ERROR',
							message: 'Merge records: Failed to update target record',
						});
					}

					// 1. Update media records to point to the target record
					await db
						.update(media)
						.set({
							recordId: targetId,
							recordUpdatedAt: new Date(),
						})
						.where(eq(media.recordId, sourceId));

					// 2. Update integration tables that reference the source record
					const integrationTables = [
						airtableCreators,
						airtableExtracts,
						airtableFormats,
						airtableSpaces,
						githubRepositories,
						githubUsers,
						lightroomImages,
						raindropBookmarks,
						raindropCollections,
						raindropTags,
						readwiseAuthors,
						readwiseDocuments,
						readwiseTags,
						twitterTweets,
						twitterUsers,
					] as const;

					for (const table of integrationTables) {
						await db
							.update(table)
							.set({
								recordId: targetId,
								recordUpdatedAt: new Date(),
							})
							.where(eq(table.recordId, sourceId));
					}

					// 3. Handle merging links
					const linksToMerge = await db.query.links.findMany({
						where: {
							OR: [
								{
									sourceId: {
										in: ids,
									},
								},
								{
									targetId: {
										in: ids,
									},
								},
							],
						},
					});

					// Store original IDs to delete them later
					const linkIdsToDelete = linksToMerge.map((link) => link.id);

					// Delete all original links involving either record
					if (linkIdsToDelete.length > 0) {
						await db.delete(links).where(inArray(links.id, linkIdsToDelete));
					}

					// Update links to replace sourceId with targetId
					const updatedLinks = linksToMerge.map((link) => ({
						// Keep original notes and predicateId
						predicateId: link.predicateId,
						notes: link.notes,
						// Update source/target IDs and timestamp
						sourceId: link.sourceId === sourceId ? targetId : link.sourceId,
						targetId: link.targetId === sourceId ? targetId : link.targetId,
						recordUpdatedAt: new Date(),
					}));

					// Deduplicate based on the composite key (sourceId, targetId, predicateId)
					// and filter out self-references
					const dedupedLinksToInsert: LinkInsert[] = [];
					const seenLinkKeys = new Set<string>();

					for (const link of updatedLinks) {
						// Skip self-references created by the merge
						if (link.sourceId === link.targetId) {
							continue;
						}

						const key = `${link.sourceId}-${link.targetId}-${link.predicateId}`;
						if (!seenLinkKeys.has(key)) {
							seenLinkKeys.add(key);
							// Only include fields needed for insertion
							dedupedLinksToInsert.push({
								sourceId: link.sourceId,
								targetId: link.targetId,
								predicateId: link.predicateId,
								notes: link.notes,
								recordUpdatedAt: link.recordUpdatedAt,
								// id will be generated by the database
							});
						}
					}

					let newLinks: LinkSelect[] = [];
					// Insert the merged and deduplicated links
					if (dedupedLinksToInsert.length > 0) {
						newLinks = await db.insert(links).values(dedupedLinksToInsert).returning();
					}

					// Collect all unique IDs that were affected by the link changes
					// Exclude the original source ID (since it's deleted) but include the target ID
					const touchedIds: DbId[] = Array.from(
						new Set([
							targetId,
							...newLinks
								.flatMap((link) => [link.sourceId, link.targetId])
								.filter((id) => id !== sourceId),
						])
					);

					// Finally, delete the source record
					const [deletedRecord] = await db
						.delete(records)
						.where(eq(records.id, sourceId))
						.returning();

					if (!deletedRecord) {
						// This case might indicate the source record was already deleted,
						// but the sequence of operations should ideally prevent this state. Log it.
						throw new TRPCError({
							code: 'INTERNAL_SERVER_ERROR',
							message: `Merge records: Source record ID ${sourceId} not found for deletion.`,
						});
					}

					// Log before returning
					console.log('[Merge Operation] Returning:', {
						updatedRecord,
						deletedRecordId: sourceId,
						touchedIds,
					});
					return {
						updatedRecord,
						deletedRecordId: sourceId,
						touchedIds,
					};
				} catch (error) {
					console.error('Merge error:', error);
					if (error instanceof TRPCError) {
						throw error;
					}
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: `Failed to merge records: ${error instanceof Error ? error.message : 'Unknown error'}`,
					});
				}
			} catch (error) {
				console.error('Merge error:', error);
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to merge records: ${error instanceof Error ? error.message : 'Unknown error'}`,
				});
			}
		}
	);
