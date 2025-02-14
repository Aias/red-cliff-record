import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
	airtableCreators,
	airtableFormats,
	airtableSpaces,
	githubUsers,
	IndexMainType,
	indexRelations,
	indices,
	IndicesInsertSchema,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseTags,
	recordCategories,
	recordCreators,
	records,
	twitterUsers,
	type IndexRelationInsert,
	type IndicesInsert,
	type RecordCategoryInsert,
	type RecordCreatorInsert,
} from '~/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';
import { DEFAULT_LIMIT, SIMILARITY_THRESHOLD } from './common';

export const indicesRouter = createTRPCRouter({
	get: publicProcedure.input(z.number().int().positive()).query(async ({ ctx: { db }, input }) => {
		const entry = await db.query.indices.findFirst({
			with: {
				recordsInCategory: {
					with: {
						record: true,
					},
				},
				recordsByCreator: {
					with: {
						record: true,
					},
				},
				recordsWithFormat: true,
			},
			where: eq(indices.id, input),
		});
		if (!entry) {
			throw new Error('Index entry not found');
		}
		return entry;
	}),

	getSources: publicProcedure
		.input(z.number().int().positive())
		.query(async ({ ctx: { db }, input }) => {
			const entry = await db.query.indices.findFirst({
				with: {
					airtableCreators: true,
					airtableFormats: true,
					airtableSpaces: true,
					githubUsers: true,
					raindropCollections: true,
					raindropTags: true,
					readwiseAuthors: true,
					readwiseTags: true,
					twitterUsers: true,
				},
				where: eq(indices.id, input),
			});
			if (!entry) {
				throw new Error('Index entry not found');
			}
			return entry;
		}),

	getQueue: publicProcedure
		.input(
			z.object({
				type: IndexMainType.optional(),
			})
		)
		.query(async ({ ctx: { db }, input }) => {
			const entries = await db.query.indices.findMany({
				columns: {
					textEmbedding: false,
				},
				where: and(
					eq(indices.needsCuration, true),
					input.type ? eq(indices.mainType, input.type) : undefined
				),
				limit: DEFAULT_LIMIT,
				orderBy: [desc(indices.recordUpdatedAt), indices.name],
			});
			return entries;
		}),

	getQueueCount: publicProcedure
		.input(
			z.object({
				type: IndexMainType.optional(),
			})
		)
		.query(async ({ ctx: { db }, input }) => {
			const count = await db.$count(
				indices,
				and(
					eq(indices.needsCuration, true),
					input.type ? eq(indices.mainType, input.type) : undefined
				)
			);
			return count;
		}),

	getSubtypes: publicProcedure.query(async ({ ctx: { db } }) => {
		const subtypes = await db
			.selectDistinct({
				subType: indices.subType,
			})
			.from(indices)
			.where(isNotNull(indices.subType))
			.orderBy(indices.subType);
		const uniqueSubtypes = new Set(
			subtypes.map((row) => row.subType).filter((subtype): subtype is string => subtype !== null)
		);
		return Array.from(uniqueSubtypes);
	}),

	upsert: publicProcedure.input(IndicesInsertSchema).mutation(async ({ ctx: { db }, input }) => {
		const { id, ...values } = input;
		const [entry] = await db
			.insert(indices)
			.values(input)
			.onConflictDoUpdate({
				target: indices.id,
				where: id ? eq(indices.id, id) : undefined,
				set: { ...values, recordUpdatedAt: new Date() },
			})
			.returning();

		if (!entry) {
			throw new Error('Failed to upsert index entry');
		}
		return entry;
	}),

	delete: publicProcedure
		.input(z.number().int().positive())
		.mutation(async ({ ctx: { db }, input }) => {
			const [deletedEntry] = await db.delete(indices).where(eq(indices.id, input)).returning();
			return deletedEntry;
		}),

	search: publicProcedure.input(z.string()).query(async ({ ctx: { db }, input }) => {
		const matches = await db.query.indices.findMany({
			where: sql`(
          ${indices.name} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
          ${indices.shortName} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
          ${indices.notes} <-> ${input} < ${SIMILARITY_THRESHOLD}
        )`,
			limit: 10,
			orderBy: [
				sql`LEAST(
            ${indices.name} <-> ${input},
            ${indices.shortName} <-> ${input},
            ${indices.notes} <-> ${input}
          )`,
				indices.needsCuration,
				desc(indices.recordUpdatedAt),
			],
			with: {
				canonicalMedia: {
					columns: {
						url: true,
					},
				},
			},
		});
		return matches;
	}),

	merge: publicProcedure
		.input(
			z.object({
				sourceId: z.number().int().positive(),
				targetId: z.number().int().positive(),
			})
		)
		.mutation(async ({ ctx: { db }, input }) => {
			const { sourceId, targetId } = input;

			try {
				if (sourceId === targetId) {
					throw new Error('sourceId and targetId must be different.');
				}

				const [source, target] = await Promise.all([
					db.query.indices.findFirst({
						where: eq(indices.id, sourceId),
					}),
					db.query.indices.findFirst({
						where: eq(indices.id, targetId),
					}),
				]);

				if (!source || !target) {
					throw new Error('Index entry not found');
				}

				// Deduplicate the sources array
				const allSources = Array.from(
					new Set([...(source.sources ?? []), ...(target.sources ?? [])])
				);

				const newRecord: IndicesInsert = {
					...source,
					...Object.fromEntries(Object.entries(target).filter(([_, value]) => value != null)), // Only spread non-null target values
					sources: allSources.length > 0 ? allSources : null,
					recordUpdatedAt: new Date(),
					textEmbedding: null,
				};

				const transactionPayload = await db.transaction(async (tx) => {
					try {
						// Update the target record with the merged data
						const [newEntry] = await tx
							.update(indices)
							.set(newRecord)
							.where(eq(indices.id, targetId))
							.returning();

						if (!newEntry) {
							throw new Error('Failed to update target entry');
						}

						const newId = newEntry.id;

						// First, update mapping tables to point to the new index.
						await tx
							.update(airtableCreators)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(airtableCreators.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableCreators', data);
							});
						await tx
							.update(airtableFormats)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(airtableFormats.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableFormats', data);
							});
						await tx
							.update(airtableSpaces)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(airtableSpaces.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableSpaces', data);
							});
						await tx
							.update(githubUsers)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(githubUsers.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated githubUsers', data);
							});
						await tx
							.update(raindropCollections)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(raindropCollections.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated raindropCollections', data);
							});
						await tx
							.update(raindropTags)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(raindropTags.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated raindropTags', data);
							});
						await tx
							.update(readwiseAuthors)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(readwiseAuthors.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated readwiseAuthors', data);
							});
						await tx
							.update(readwiseTags)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(readwiseTags.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated readwiseTags', data);
							});
						await tx
							.update(twitterUsers)
							.set({ indexEntryId: newId, recordUpdatedAt: new Date() })
							.where(eq(twitterUsers.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated twitterUsers', data);
							});

						// === Update direct references to outdated index ===
						await tx
							.update(records)
							.set({
								formatId: newId,
								recordUpdatedAt: new Date(),
							})
							.where(eq(records.formatId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated records with formatId', data);
							});
						await tx
							.update(indices)
							.set({
								aliasOf: newId,
								recordUpdatedAt: new Date(),
							})
							.where(eq(indices.aliasOf, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated indices with aliasOf', data);
							});

						// === Merge many-to-many relationships for indexRelations ===

						// Query all indexRelations where the outdated ID (sourceId) or the new record (targetId) appears.
						const indexRelationsRows = await tx.query.indexRelations.findMany({
							where: or(
								eq(indexRelations.sourceId, sourceId),
								eq(indexRelations.targetId, sourceId),
								eq(indexRelations.sourceId, targetId),
								eq(indexRelations.targetId, targetId)
							),
						});

						console.log('indexRelationsRows to be processed:', indexRelationsRows);

						// Delete all rows referencing the outdated record's ID.
						if (indexRelationsRows.length > 0) {
							await tx.delete(indexRelations).where(
								inArray(
									indexRelations.id,
									indexRelationsRows.map((row) => row.id)
								)
							);
						}

						// Update in memory: change any occurrence of the outdated ID (sourceId) to the new ID (newId).
						const updatedIndexRelations: IndexRelationInsert[] = indexRelationsRows.map((row) => ({
							...row,
							sourceId: row.sourceId === sourceId ? newId : row.sourceId,
							targetId: row.targetId === sourceId ? newId : row.targetId,
							recordUpdatedAt: new Date(),
						}));

						// Deduplicate based on the composite key (sourceId, targetId, type).
						const dedupedIndexRelations: typeof updatedIndexRelations = [];
						const seenIndexRelationKeys = new Set<string>();
						updatedIndexRelations.forEach((row) => {
							const key = `${row.sourceId}-${row.targetId}-${row.type}`;
							if (!seenIndexRelationKeys.has(key)) {
								seenIndexRelationKeys.add(key);
								dedupedIndexRelations.push(row);
							}
						});

						console.log('dedupedIndexRelations to be inserted:', dedupedIndexRelations);

						if (dedupedIndexRelations.length > 0) {
							await tx.insert(indexRelations).values(dedupedIndexRelations);
						}

						// === Merge many-to-many relationships for recordCreators ===

						// Get all recordCreators where the entity is the outdated index.
						const recordCreatorsRows = await tx.query.recordCreators.findMany({
							where: or(
								eq(recordCreators.entityId, sourceId),
								eq(recordCreators.entityId, targetId)
							),
						});

						console.log('recordCreatorsRows to be processed:', recordCreatorsRows);

						// Delete the rows that reference the outdated index.
						if (recordCreatorsRows.length > 0) {
							await tx.delete(recordCreators).where(
								inArray(
									recordCreators.id,
									recordCreatorsRows.map((row) => row.id)
								)
							);
						}

						// Update in memory: set entityId to the new ID.
						const updatedRecordCreators: RecordCreatorInsert[] = recordCreatorsRows.map((row) => ({
							...row,
							entityId: newId,
							recordUpdatedAt: new Date(),
						}));

						// Deduplicate based on (recordId, entityId, role).
						const dedupedRecordCreators: typeof updatedRecordCreators = [];
						const seenRecordCreatorKeys = new Set<string>();
						updatedRecordCreators.forEach((row) => {
							const key = `${row.recordId}-${row.entityId}-${row.role}`;
							if (!seenRecordCreatorKeys.has(key)) {
								seenRecordCreatorKeys.add(key);
								dedupedRecordCreators.push(row);
							}
						});

						console.log('dedupedRecordCreators to be inserted:', dedupedRecordCreators);

						if (dedupedRecordCreators.length > 0) {
							await tx.insert(recordCreators).values(dedupedRecordCreators);
						}

						// === Merge many-to-many relationships for recordCategories ===

						// Get all recordCategories where the category is the outdated index.
						const recordCategoriesRows = await tx.query.recordCategories.findMany({
							where: or(
								eq(recordCategories.categoryId, sourceId),
								eq(recordCategories.categoryId, targetId)
							),
						});

						console.log('recordCategoriesRows to be processed:', recordCategoriesRows);

						// Delete rows referencing the outdated index.
						if (recordCategoriesRows.length > 0) {
							await tx.delete(recordCategories).where(
								inArray(
									recordCategories.id,
									recordCategoriesRows.map((row) => row.id)
								)
							);
						}

						// Update in memory: set categoryId to the new ID.
						const updatedRecordCategories: RecordCategoryInsert[] = recordCategoriesRows.map(
							(row) => ({
								...row,
								categoryId: newId,
								recordUpdatedAt: new Date(),
							})
						);

						// Deduplicate based on (recordId, categoryId, type).
						const dedupedRecordCategories: typeof updatedRecordCategories = [];
						const seenRecordCategoryKeys = new Set<string>();
						updatedRecordCategories.forEach((row) => {
							const key = `${row.recordId}-${row.categoryId}-${row.type}`;
							if (!seenRecordCategoryKeys.has(key)) {
								seenRecordCategoryKeys.add(key);
								dedupedRecordCategories.push(row);
							}
						});

						console.log('dedupedRecordCategories to be inserted:', dedupedRecordCategories);

						if (dedupedRecordCategories.length > 0) {
							await tx.insert(recordCategories).values(dedupedRecordCategories);
						}

						// Delete the old source record after merging
						await tx
							.delete(indices)
							.where(eq(indices.id, sourceId))
							.returning()
							.then((data) => {
								console.log('Deleted source index', data);
							});

						return { newEntry };
					} catch (error) {
						console.error('Transaction error:', error);
						throw new Error(
							`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
					}
				});

				return {
					source,
					target,
					...transactionPayload,
				};
			} catch (error) {
				console.error('Merge error:', error);
				throw new Error(
					`Failed to merge indices: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			}
		}),
});
