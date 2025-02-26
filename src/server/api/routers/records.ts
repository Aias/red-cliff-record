import { TRPCError } from '@trpc/server';
import { arrayOverlaps } from 'drizzle-orm';
import { z } from 'zod';
import {
	IntegrationTypeSchema,
	RecordInsertSchema,
	records,
	RecordTypeSchema,
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

export const recordsRouter = createTRPCRouter({
	get: getRecord,
	list: listRecords,
	search: searchRecords,
	upsert: upsertRecord,
});
