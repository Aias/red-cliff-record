import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
	airtableCreators,
	airtableFormats,
	airtableSpaces,
	githubUsers,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseTags,
	recordCategories,
	recordCreators,
	records,
	twitterUsers,
} from '~/server/db/schema';
import {
	IndexMainType,
	indexRelations,
	indices,
	IndicesInsertSchema,
	type IndicesInsert,
} from '~/server/db/schema/indices';
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

	getQueueCount: publicProcedure.query(async ({ ctx: { db } }) => {
		const count = await db.$count(indices, eq(indices.needsCuration, true));
		return count;
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

						// Update all relationships referencing the old sourceId to point to the updated target record
						await tx
							.update(airtableCreators)
							.set({ indexEntryId: newId })
							.where(eq(airtableCreators.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableCreators', data);
							});
						await tx
							.update(airtableFormats)
							.set({ indexEntryId: newId })
							.where(eq(airtableFormats.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableFormats', data);
							});
						await tx
							.update(airtableSpaces)
							.set({ indexEntryId: newId })
							.where(eq(airtableSpaces.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated airtableSpaces', data);
							});
						await tx
							.update(githubUsers)
							.set({ indexEntryId: newId })
							.where(eq(githubUsers.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated githubUsers', data);
							});
						await tx
							.update(raindropCollections)
							.set({ indexEntryId: newId })
							.where(eq(raindropCollections.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated raindropCollections', data);
							});
						await tx
							.update(raindropTags)
							.set({ indexEntryId: newId })
							.where(eq(raindropTags.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated raindropTags', data);
							});
						await tx
							.update(readwiseAuthors)
							.set({ indexEntryId: newId })
							.where(eq(readwiseAuthors.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated readwiseAuthors', data);
							});
						await tx
							.update(readwiseTags)
							.set({ indexEntryId: newId })
							.where(eq(readwiseTags.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated readwiseTags', data);
							});
						await tx
							.update(twitterUsers)
							.set({ indexEntryId: newId })
							.where(eq(twitterUsers.indexEntryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated twitterUsers', data);
							});

						await tx
							.update(indexRelations)
							.set({ sourceId: newId })
							.where(eq(indexRelations.sourceId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated indexRelations source', data);
							});
						await tx
							.update(indexRelations)
							.set({ targetId: newId })
							.where(eq(indexRelations.targetId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated indexRelations target', data);
							});
						await tx
							.update(recordCreators)
							.set({ entityId: newId })
							.where(eq(recordCreators.entityId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated recordCreators', data);
							});
						await tx
							.update(recordCategories)
							.set({ categoryId: newId })
							.where(eq(recordCategories.categoryId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated recordCategories', data);
							});
						await tx
							.update(records)
							.set({ formatId: newId })
							.where(eq(records.formatId, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated records', data);
							});
						await tx
							.update(indices)
							.set({ aliasOf: newId })
							.where(eq(indices.aliasOf, sourceId))
							.returning()
							.then((data) => {
								console.log('Updated indices aliases', data);
							});

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
