import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
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
import type { LinkInsert } from '@/db/schema';

export const merge = publicProcedure
	.input(
		z.object({
			sourceId: z.number().int().positive(),
			targetId: z.number().int().positive(),
		})
	)
	.mutation(async ({ ctx: { db }, input }) => {
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

			const transactionResult = await db.transaction(async (tx) => {
				try {
					// If the source record has a slug, nullify it first to avoid unique constraint conflict
					if (source.slug) {
						await tx.update(records).set({ slug: null }).where(eq(records.id, sourceId));
					}

					// Update the target record with the merged data
					const [updatedRecord] = await tx
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
					await tx
						.update(media)
						.set({
							recordId: targetId,
							recordUpdatedAt: new Date(),
						})
						.where(eq(media.recordId, sourceId));

					// 2. Update integration tables that reference the source record
					const integrationTables = [
						{ table: airtableCreators, column: 'recordId' as const },
						{ table: airtableExtracts, column: 'recordId' as const },
						{ table: airtableFormats, column: 'recordId' as const },
						{ table: airtableSpaces, column: 'recordId' as const },
						{ table: githubRepositories, column: 'recordId' as const },
						{ table: githubUsers, column: 'recordId' as const },
						{ table: lightroomImages, column: 'recordId' as const },
						{ table: raindropBookmarks, column: 'recordId' as const },
						{ table: raindropCollections, column: 'recordId' as const },
						{ table: raindropTags, column: 'recordId' as const },
						{ table: readwiseAuthors, column: 'recordId' as const },
						{ table: readwiseDocuments, column: 'recordId' as const },
						{ table: readwiseTags, column: 'recordId' as const },
						{ table: twitterTweets, column: 'recordId' as const },
						{ table: twitterUsers, column: 'recordId' as const },
					];

					for (const { table, column } of integrationTables) {
						await tx
							.update(table)
							.set({
								[column]: targetId,
								recordUpdatedAt: new Date(),
							})
							.where(eq(table[column], sourceId));
					}

					// 3. Handle merging links
					const linksToMerge = await tx.query.links.findMany({
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
						await tx.delete(links).where(inArray(links.id, linkIdsToDelete));
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

					// Insert the merged and deduplicated links
					if (dedupedLinksToInsert.length > 0) {
						await tx.insert(links).values(dedupedLinksToInsert);
					}

					// Finally, delete the source record
					const [deletedRecord] = await tx
						.delete(records)
						.where(eq(records.id, sourceId))
						.returning();

					if (!deletedRecord) {
						// This case might indicate the source record was already deleted,
						// but the transaction should ideally prevent this state. Log it.
						console.warn(`Merge records: Source record ID ${sourceId} not found for deletion.`);
					}

					// Log before returning from transaction
					console.log('[Merge Transaction] Returning:', { updatedRecord, deletedRecord });
					return {
						updatedRecord,
						deletedRecord,
					};
				} catch (error) {
					console.error('Transaction error:', error);
					// Rollback is handled automatically by db.transaction
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
					});
				}
			});

			return transactionResult;
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
	});
