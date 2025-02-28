import { TRPCError } from '@trpc/server';
import { arrayOverlaps, eq, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import {
	airtableCreators,
	airtableExtracts,
	airtableFormats,
	airtableSpaces,
	githubRepositories,
	githubUsers,
	IntegrationTypeSchema,
	lightroomImages,
	media,
	raindropBookmarks,
	raindropCollections,
	raindropTags,
	readwiseAuthors,
	readwiseDocuments,
	readwiseTags,
	recordCreators,
	RecordInsertSchema,
	recordRelations,
	records,
	RecordTypeSchema,
	twitterTweets,
	twitterUsers,
} from '@/server/db/schema';
import { createTRPCRouter, publicProcedure } from '../init';
import { DEFAULT_LIMIT, SIMILARITY_THRESHOLD } from './common';

const IdSchema = z.number().int().positive();

// Define the order fields enum
const OrderByFieldSchema = z.enum([
	'recordUpdatedAt',
	'recordCreatedAt',
	'title',
	'contentCreatedAt',
	'contentUpdatedAt',
	'rating',
	'childOrder',
	'id',
]);

// Define the order direction enum
const OrderDirectionSchema = z.enum(['asc', 'desc']);

// Define the order criteria schema
const OrderCriteriaSchema = z.object({
	field: OrderByFieldSchema,
	direction: OrderDirectionSchema.optional().default('desc'),
});

const getRecord = publicProcedure.input(IdSchema).query(async ({ ctx: { db }, input }) => {
	const record = await db.query.records.findFirst({
		with: {
			creators: {
				with: {
					creator: true,
				},
			},
			format: true,
			parent: true,
			children: true,
			media: true,
			references: {
				with: {
					target: true,
				},
			},
			transcludes: true,
		},
		where: (records, { eq }) => eq(records.id, input),
	});

	if (!record) {
		throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
	}

	return record;
});

const ListRecordsInputSchema = z.object({
	filters: z
		.object({
			type: RecordTypeSchema.optional(),
			title: z.string().nullable().optional(),
			creatorId: IdSchema.nullable().optional(),
			formatId: IdSchema.nullable().optional(),
			domain: z.string().nullable().optional(),
			parentId: IdSchema.nullable().optional(),
			minRating: z.number().int().gte(-2).optional(),
			maxRating: z.number().int().lte(2).optional(),
			isIndexNode: z.boolean().optional(),
			isFormat: z.boolean().optional(),
			isPrivate: z.boolean().optional(),
			isCurated: z.boolean().optional(),
			hasReminder: z.boolean().optional(),
			source: IntegrationTypeSchema.optional(),
		})
		.optional()
		.default({}),
	limit: z.number().int().positive().optional().default(DEFAULT_LIMIT),
	offset: z.number().int().gte(0).optional().default(0),
	orderBy: z
		.array(OrderCriteriaSchema)
		.optional()
		.default([{ field: 'recordCreatedAt', direction: 'desc' }]),
});
export type ListRecordsInput = z.infer<typeof ListRecordsInputSchema>;

const listRecords = publicProcedure
	.input(ListRecordsInputSchema)
	.query(async ({ ctx: { db }, input }) => {
		const {
			filters: {
				type,
				title,
				creatorId,
				formatId,
				domain,
				parentId,
				minRating,
				maxRating,
				isIndexNode,
				isFormat,
				isPrivate,
				isCurated,
				hasReminder,
				source,
			},
			limit,
			offset,
			orderBy,
		} = input;
		return db.query.records.findMany({
			with: {
				creators: {
					with: {
						creator: true,
					},
				},
				format: true,
				parent: true,
				media: true,
			},
			where: (records, { eq, and, isNull, isNotNull, gte, lte, ilike, sql }) => {
				const whereClauses = [];

				// Handle each filter
				if (type !== undefined) {
					whereClauses.push(eq(records.type, type));
				}

				if (title !== undefined) {
					if (title === null) {
						whereClauses.push(isNull(records.title));
					} else {
						whereClauses.push(eq(records.title, title));
					}
				}

				if (creatorId !== undefined) {
					if (creatorId === null) {
						// No creators associated with this record
						whereClauses.push(
							sql`NOT EXISTS (SELECT 1 FROM record_creators WHERE record_creators.record_id = ${records.id})`
						);
					} else {
						// Records with this specific creator
						whereClauses.push(
							sql`EXISTS (SELECT 1 FROM record_creators WHERE record_creators.record_id = ${records.id} AND record_creators.creator_id = ${creatorId})`
						);
					}
				}

				if (formatId !== undefined) {
					if (formatId === null) {
						whereClauses.push(isNull(records.formatId));
					} else {
						whereClauses.push(eq(records.formatId, formatId));
					}
				}

				if (domain !== undefined) {
					if (domain === null) {
						whereClauses.push(isNull(records.url));
					} else {
						// Match records where URL contains the domain
						whereClauses.push(ilike(records.url, `%${domain}%`));
					}
				}

				if (parentId !== undefined) {
					if (parentId === null) {
						whereClauses.push(isNull(records.parentId));
					} else {
						whereClauses.push(eq(records.parentId, parentId));
					}
				}

				if (minRating !== undefined) {
					whereClauses.push(gte(records.rating, minRating));
				}

				if (maxRating !== undefined) {
					whereClauses.push(lte(records.rating, maxRating));
				}

				if (isIndexNode !== undefined) {
					whereClauses.push(eq(records.isIndexNode, isIndexNode));
				}

				if (isFormat !== undefined) {
					whereClauses.push(eq(records.isFormat, isFormat));
				}

				if (isPrivate !== undefined) {
					whereClauses.push(eq(records.isPrivate, isPrivate));
				}

				if (isCurated !== undefined) {
					whereClauses.push(eq(records.isCurated, isCurated));
				}

				if (hasReminder !== undefined) {
					if (hasReminder) {
						whereClauses.push(isNotNull(records.reminderAt));
					} else {
						whereClauses.push(isNull(records.reminderAt));
					}
				}

				if (source !== undefined) {
					// Check if the source is in the sources array
					whereClauses.push(arrayOverlaps(records.sources, [source]));
				}

				return and(...whereClauses);
			},
			limit,
			offset,
			orderBy: (records, { asc, desc }) => {
				// Map each order criteria to a sort expression
				return orderBy.map(({ field, direction }) => {
					const orderColumn = records[field];
					return direction === 'asc' ? asc(orderColumn) : desc(orderColumn);
				});
			},
		});
	});

const searchRecords = publicProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
	return db.query.records.findMany({
		where: (records, { sql }) => sql`(
			${records.title} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
			${records.content} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
			${records.notes} <-> ${input} < ${SIMILARITY_THRESHOLD} OR
			${records.summary} <-> ${input} < ${SIMILARITY_THRESHOLD}
		)`,
		limit: 10,
		orderBy: (records, { desc, sql }) => [
			sql`LEAST(
				${records.title} <-> ${input},
				${records.content} <-> ${input},
				${records.notes} <-> ${input},
				${records.summary} <-> ${input}
			)`,
			desc(records.recordUpdatedAt),
		],
		with: {
			creators: {
				with: {
					creator: true,
				},
			},
			media: true,
		},
	});
});

const upsertRecord = publicProcedure
	.input(RecordInsertSchema)
	.mutation(async ({ ctx: { db }, input }) => {
		const [result] = await db
			.insert(records)
			.values(input)
			.onConflictDoUpdate({
				target: records.id,
				set: {
					...input,
					recordUpdatedAt: new Date(),
					textEmbedding: null, // Changes require recalculating the embedding.
				},
			})
			.returning();

		if (!result) {
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: `Record upsert failed. Input data:\n\n${JSON.stringify(input, null, 2)}`,
			});
		}

		return result;
	});

const mergeRecords = publicProcedure
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
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Source and target records must be different.',
				});
			}

			const [source, target] = await Promise.all([
				db.query.records.findFirst({
					where: (records, { eq }) => eq(records.id, sourceId),
				}),
				db.query.records.findFirst({
					where: (records, { eq }) => eq(records.id, targetId),
				}),
			]);

			if (!source || !target) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'One or both records not found',
				});
			}

			// Deduplicate the sources array
			const allSources = Array.from(
				new Set([...(source.sources ?? []), ...(target.sources ?? [])])
			);

			// Merge record data, preferring target's non-null (and non-empty string) values
			const mergedRecord = {
				...source,
				...Object.fromEntries(
					Object.entries(target).filter(([_, value]) => !(value === null || value === ''))
				),
				sources: allSources.length > 0 ? allSources : null,
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
						throw new Error('Failed to update target record');
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
						.where(eq(records.parentId, sourceId));

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
						where: or(
							eq(recordRelations.sourceId, sourceId),
							eq(recordRelations.targetId, sourceId),
							eq(recordRelations.sourceId, targetId),
							eq(recordRelations.targetId, targetId)
						),
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
						where: or(
							eq(recordCreators.recordId, sourceId),
							eq(recordCreators.recordId, targetId),
							eq(recordCreators.creatorId, sourceId),
							eq(recordCreators.creatorId, targetId)
						),
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

			return {
				source,
				target,
				...transactionResult,
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
	});

const findDuplicates = publicProcedure.input(IdSchema).query(async ({ ctx: { db }, input }) => {
	try {
		console.log(`[findDuplicates] Starting duplicate search for record ID: ${input}`);

		// First, get the source record with its data
		const sourceRecord = await db.query.records.findFirst({
			where: (records, { eq }) => eq(records.id, input),
			with: {
				creators: {
					with: {
						creator: true,
					},
				},
			},
		});

		if (!sourceRecord) {
			console.log(`[findDuplicates] Record not found with ID: ${input}`);
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
		}

		// Extract key fields for comparison
		const { title, url, content, summary, notes, type, abbreviation, sense } = sourceRecord;
		console.log(`[findDuplicates] Source record found: ${title || 'Untitled'} (${type})`);

		// Build a query to find potential duplicates with error handling
		try {
			// Build a query to find potential duplicates
			// We'll use a combination of exact matches and similarity searches
			const potentialDuplicates = await db.query.records.findMany({
				where: (records, { and, ne, or, sql, eq, ilike }) => {
					const conditions = [];

					// Exclude the source record itself
					conditions.push(ne(records.id, input));

					// Build OR conditions for different matching criteria
					const matchConditions = [];

					// Exact URL match (if URL exists)
					if (url) {
						matchConditions.push(eq(records.url, url));
					}

					// Title similarity - use a more lenient threshold
					if (title) {
						// Use a more lenient threshold for title similarity
						matchConditions.push(
							sql`${records.title} <-> ${title} < ${SIMILARITY_THRESHOLD * 0.9}`
						);

						// Add partial string matching for titles with longer words
						const titleWords = title.split(/\s+/).filter((word) => word.length > 3);
						if (titleWords.length > 0) {
							titleWords.forEach((word) => {
								matchConditions.push(ilike(records.title, `%${word}%`));
							});
						}
					}

					// Add separate conditions for abbreviation and sense
					if (abbreviation) {
						matchConditions.push(
							sql`${records.abbreviation} <-> ${abbreviation} < ${SIMILARITY_THRESHOLD}`
						);
					}

					if (sense) {
						matchConditions.push(sql`${records.sense} <-> ${sense} < ${SIMILARITY_THRESHOLD}`);
					}

					// Content similarity (if content exists)
					if (content) {
						matchConditions.push(
							sql`${records.content} <-> ${content} < ${SIMILARITY_THRESHOLD * 0.9}`
						);
					}

					// Summary similarity (if summary exists)
					if (summary) {
						matchConditions.push(
							sql`${records.summary} <-> ${summary} < ${SIMILARITY_THRESHOLD * 0.9}`
						);
					}

					// Notes similarity (if notes exists)
					if (notes) {
						matchConditions.push(
							sql`${records.notes} <-> ${notes} < ${SIMILARITY_THRESHOLD * 0.9}`
						);
					}

					// Add the OR conditions if we have any
					if (matchConditions.length > 0) {
						conditions.push(or(...matchConditions));
					}

					// Match on record type if available (as an AND condition)
					if (type) {
						conditions.push(eq(records.type, type));
					}

					return and(...conditions);
				},
				with: {
					creators: {
						with: {
							creator: true,
						},
					},
					media: true,
					format: true,
				},
				limit: 25, // Increase limit to get more candidates
				orderBy: (records, { desc, sql }) => [
					// Use PostgreSQL's built-in similarity operators for ordering
					sql`LEAST(
						COALESCE(${records.title} <-> ${title || ''}, 1),
						COALESCE(${records.content} <-> ${content || ''}, 1),
						COALESCE(${records.summary} <-> ${summary || ''}, 1),
						COALESCE(${records.notes} <-> ${notes || ''}, 1)
					)`,
					desc(records.recordUpdatedAt),
				],
			});

			console.log(`[findDuplicates] Found ${potentialDuplicates.length} potential duplicates`);

			// Calculate a similarity score for each potential duplicate
			const duplicatesWithScores = potentialDuplicates.map((duplicate) => {
				let score = 0;
				let maxScore = 0;
				const scoreDetails: Record<string, number> = {}; // For debugging

				// URL exact match is a strong signal
				if (url && duplicate.url === url) {
					score += 100;
					maxScore += 100;
					scoreDetails.url = 100;
				} else if (url) {
					maxScore += 100;
					scoreDetails.url = 0;
				}

				// Title similarity - rely on PostgreSQL's similarity
				if (title && duplicate.title) {
					// Use the standard similarity calculation
					const titleSimilarity = calculateSimilarity(title, duplicate.title);
					const titleScore = titleSimilarity * 150;
					score += titleScore;
					maxScore += 150;
					scoreDetails.title = titleScore;
				} else if (title || duplicate.title) {
					maxScore += 150;
					scoreDetails.title = 0;
				}

				// Abbreviation similarity
				if (abbreviation && duplicate.abbreviation) {
					const abbrSimilarity = calculateSimilarity(abbreviation, duplicate.abbreviation);
					const abbrScore = abbrSimilarity * 40;
					score += abbrScore;
					maxScore += 40;
					scoreDetails.abbreviation = abbrScore;
				} else if (abbreviation || duplicate.abbreviation) {
					maxScore += 40;
					scoreDetails.abbreviation = 0;
				}

				// Sense similarity
				if (sense && duplicate.sense) {
					const senseSimilarity = calculateSimilarity(sense, duplicate.sense);
					const senseScore = senseSimilarity * 40;
					score += senseScore;
					maxScore += 40;
					scoreDetails.sense = senseScore;
				} else if (sense || duplicate.sense) {
					maxScore += 40;
					scoreDetails.sense = 0;
				}

				// Content similarity
				if (content && duplicate.content) {
					const contentSimilarity = calculateSimilarity(content, duplicate.content);
					const contentScore = contentSimilarity * 30;
					score += contentScore;
					maxScore += 30;
					scoreDetails.content = contentScore;
				} else if (content || duplicate.content) {
					maxScore += 30;
					scoreDetails.content = 0;
				}

				// Summary similarity
				if (summary && duplicate.summary) {
					const summarySimilarity = calculateSimilarity(summary, duplicate.summary);
					const summaryScore = summarySimilarity * 20;
					score += summaryScore;
					maxScore += 20;
					scoreDetails.summary = summaryScore;
				} else if (summary || duplicate.summary) {
					maxScore += 20;
					scoreDetails.summary = 0;
				}

				// Notes similarity
				if (notes && duplicate.notes) {
					const notesSimilarity = calculateSimilarity(notes, duplicate.notes);
					const notesScore = notesSimilarity * 15;
					score += notesScore;
					maxScore += 15;
					scoreDetails.notes = notesScore;
				} else if (notes || duplicate.notes) {
					maxScore += 15;
					scoreDetails.notes = 0;
				}

				// Creator overlap
				const sourceCreatorIds = new Set(sourceRecord.creators.map((c) => c.creatorId));
				const duplicateCreatorIds = new Set(duplicate.creators.map((c) => c.creatorId));

				if (sourceCreatorIds.size > 0 && duplicateCreatorIds.size > 0) {
					const overlapCount = [...sourceCreatorIds].filter((id) =>
						duplicateCreatorIds.has(id)
					).length;
					const overlapScore =
						(overlapCount / Math.max(sourceCreatorIds.size, duplicateCreatorIds.size)) * 50;
					score += overlapScore;
					maxScore += 50;
					scoreDetails.creators = overlapScore;
				} else if (sourceCreatorIds.size > 0 || duplicateCreatorIds.size > 0) {
					maxScore += 50;
					scoreDetails.creators = 0;
				}

				// Add type match bonus (small bonus if types match)
				if (duplicate.type === type) {
					score += 5;
					maxScore += 5;
					scoreDetails.typeMatch = 5;
				} else {
					maxScore += 5;
					scoreDetails.typeMatch = 0;
				}

				// Normalize score as a percentage
				const normalizedScore = maxScore > 0 ? (score / maxScore) * 100 : 0;

				// Log detailed scoring for debugging
				if (normalizedScore > 35) {
					// Lower threshold for logging
					console.log(
						`[findDuplicates] Potential match (${Math.round(normalizedScore)}%) found with record ${duplicate.id}: ${duplicate.title || 'Untitled'}`
					);
					console.log(`[findDuplicates] Score details:`, scoreDetails);
				}

				return {
					...duplicate,
					similarityScore: Math.round(normalizedScore),
				};
			});

			// Sort by similarity score (highest first) and return top results
			const result = duplicatesWithScores
				.sort((a, b) => b.similarityScore - a.similarityScore)
				.slice(0, 5); // Return more results

			console.log(`[findDuplicates] Returning ${result.length} duplicates for record ID: ${input}`);
			return result;
		} catch (dbError) {
			console.error('[findDuplicates] Database query error:', dbError);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for duplicates in database',
				cause: dbError,
			});
		}
	} catch (error) {
		console.error('[findDuplicates] Unhandled error:', error);
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: `Failed to find duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
		});
	}
});

// Helper function to calculate text similarity (simple Jaccard similarity)
function calculateSimilarity(text1: string | null, text2: string | null): number {
	if (!text1 || !text2) return 0;

	try {
		// Normalize and tokenize texts
		const tokens1 = new Set(
			text1
				.toLowerCase()
				.replace(/[^\w\s]/g, '')
				.split(/\s+/)
				.filter((token) => token.length > 1) // More lenient token length
		);

		const tokens2 = new Set(
			text2
				.toLowerCase()
				.replace(/[^\w\s]/g, '')
				.split(/\s+/)
				.filter((token) => token.length > 1) // More lenient token length
		);

		if (tokens1.size === 0 || tokens2.size === 0) return 0;

		// Calculate Jaccard similarity: intersection size / union size
		const intersection = new Set([...tokens1].filter((token) => tokens2.has(token)));
		const union = new Set([...tokens1, ...tokens2]);

		return intersection.size / union.size;
	} catch (error: unknown) {
		console.error('[calculateSimilarity] Error calculating similarity:', error);
		return 0; // Return 0 similarity on error
	}
}

export const recordsRouter = createTRPCRouter({
	get: getRecord,
	list: listRecords,
	search: searchRecords,
	upsert: upsertRecord,
	merge: mergeRecords,
	findDuplicates,
});
