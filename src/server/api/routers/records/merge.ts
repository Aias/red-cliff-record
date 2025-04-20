import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne } from 'drizzle-orm';
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
	media,
	raindropBookmarks,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseTags,
	recordCreators,
	recordRelations,
	records,
	twitterTweets,
	twitterUsers,
} from '@/db/schema';

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
			const mergedRecord = {
				...source,
				...Object.fromEntries(
					Object.entries(target).filter(([key, value]) => {
						// Skip summary, content, and notes as we'll handle them separately
						if (key === 'summary' || key === 'content' || key === 'notes') {
							return false;
						}
						if (['rating', 'isIndexNode', 'isFormat', 'isPrivate', 'isCurated'].includes(key)) {
							return false;
						}
						return !(value === null || value === '');
					})
				),
				// Merge text fields
				summary: mergeTextFields(source.summary, target.summary),
				content: mergeTextFields(source.content, target.content),
				notes: mergeTextFields(source.notes, target.notes),
				sources: allSources.length > 0 ? allSources : null,
				rating: Math.max(source.rating, target.rating),
				isIndexNode: source.isIndexNode || target.isIndexNode,
				isFormat: source.isFormat || target.isFormat,
				isPrivate: source.isPrivate || target.isPrivate,
				isCurated: source.isCurated || target.isCurated,
				// If merging child into parent, set parentId to null
				parentId: source.parentId === targetId ? null : target.parentId || source.parentId,
				recordUpdatedAt: new Date(),
				textEmbedding: null, // Changes require recalculating the embedding
			};

			const transactionResult = await db.transaction(async (tx) => {
				try {
					// Update the target record with the merged data
					const [updatedRecord] = await tx
						.update(records)
						.set(mergedRecord)
						.where(eq(records.id, targetId))
						.returning();

					if (!updatedRecord) {
						throw new TRPCError({
							code: 'INTERNAL_SERVER_ERROR',
							message: 'Merge records: Failed to update target record',
						});
					}

					// Update all references to the source record to point to the target record
					// 1. Update records that reference the source record in any of the self-referencing columns
					await tx
						.update(records)
						.set({
							formatId: targetId,
							recordUpdatedAt: new Date(),
						})
						.where(eq(records.formatId, sourceId));

					await tx
						.update(records)
						.set({
							parentId: targetId,
							recordUpdatedAt: new Date(),
						})
						.where(and(eq(records.parentId, sourceId), ne(records.id, targetId)));

					await tx
						.update(records)
						.set({
							transcludeId: targetId,
							recordUpdatedAt: new Date(),
						})
						.where(eq(records.transcludeId, sourceId));

					// 1.5. Update media records to point to the target record
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

					// 3. Handle record relations (non-hierarchical relationships)
					const recordRelationsRows = await tx.query.recordRelations.findMany({
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

					// Delete all relations involving either record
					if (recordRelationsRows.length > 0) {
						await tx.delete(recordRelations).where(
							inArray(
								recordRelations.id,
								recordRelationsRows.map((row) => row.id)
							)
						);
					}

					// Update relations to use the target ID instead of source ID
					const updatedRelations = recordRelationsRows.map((row) => ({
						...row,
						sourceId: row.sourceId === sourceId ? targetId : row.sourceId,
						targetId: row.targetId === sourceId ? targetId : row.targetId,
						recordUpdatedAt: new Date(),
					}));

					// Deduplicate based on the composite key (sourceId, targetId, type)
					const dedupedRelations = [];
					const seenRelationKeys = new Set<string>();

					for (const row of updatedRelations) {
						// Skip self-references that would be created during the merge
						if (row.sourceId === row.targetId) {
							continue;
						}

						const key = `${row.sourceId}-${row.targetId}-${row.type}`;
						if (!seenRelationKeys.has(key)) {
							seenRelationKeys.add(key);
							dedupedRelations.push(row);
						}
					}

					if (dedupedRelations.length > 0) {
						await tx.insert(recordRelations).values(dedupedRelations);
					}

					// 4. Handle record creators
					const recordCreatorsRows = await tx.query.recordCreators.findMany({
						where: {
							OR: [
								{
									recordId: {
										in: ids,
									},
								},
								{
									creatorId: {
										in: ids,
									},
								},
							],
						},
					});

					// Delete all creator relationships involving either record
					if (recordCreatorsRows.length > 0) {
						await tx.delete(recordCreators).where(
							inArray(
								recordCreators.id,
								recordCreatorsRows.map((row) => row.id)
							)
						);
					}

					// Update creator relationships to use the target ID
					const updatedCreators = recordCreatorsRows.map((row) => ({
						...row,
						recordId: row.recordId === sourceId ? targetId : row.recordId,
						creatorId: row.creatorId === sourceId ? targetId : row.creatorId,
						recordUpdatedAt: new Date(),
					}));

					// Deduplicate based on the composite key (recordId, creatorId, creatorRole)
					const dedupedCreators = [];
					const seenCreatorKeys = new Set<string>();

					for (const row of updatedCreators) {
						// Skip self-references
						if (row.recordId === row.creatorId) {
							continue;
						}

						const key = `${row.recordId}-${row.creatorId}-${row.creatorRole}`;
						if (!seenCreatorKeys.has(key)) {
							seenCreatorKeys.add(key);
							dedupedCreators.push(row);
						}
					}

					if (dedupedCreators.length > 0) {
						await tx.insert(recordCreators).values(dedupedCreators);
					}

					// Finally, delete the source record
					const [deletedRecord] = await tx
						.delete(records)
						.where(eq(records.id, sourceId))
						.returning();

					return {
						updatedRecord,
						deletedRecord,
					};
				} catch (error) {
					console.error('Transaction error:', error);
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
