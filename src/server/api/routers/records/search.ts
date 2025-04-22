import { TRPCError } from '@trpc/server';
import { and, desc, eq, getTableColumns, isNotNull, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { similarity, SIMILARITY_THRESHOLD } from '../common';
import { SearchRecordsInputSchema } from '../records.types';
import { records, type RecordSelect } from '@/db/schema';

export const search = publicProcedure
	.input(SearchRecordsInputSchema)
	.query(({ ctx: { db }, input }) => {
		const {
			query,
			filters: { recordType },
			limit,
		} = input;
		return db.query.records.findMany({
			where: {
				RAW: (records, { sql }) =>
					sql`(
						${records.title} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.content} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.notes} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
						${records.summary} <-> ${query} < ${SIMILARITY_THRESHOLD}
					)`,
				type: recordType,
			},
			limit,
			orderBy: (records, { desc, sql }) => [
				sql`LEAST(
				${records.title} <-> ${query},
				${records.content} <-> ${query},
				${records.notes} <-> ${query},
				${records.summary} <-> ${query}
			)`,
				desc(records.recordUpdatedAt),
			],
			with: {
				outgoingLinks: true,
				media: true,
			},
		});
	});

export const similaritySearch = publicProcedure
	.input(
		z.object({
			vector: z.number().array(),
			limit: z.number().optional().default(20),
			exclude: z.number().array().optional(),
		})
	)
	.query(async ({ ctx: { db }, input }): Promise<Array<RecordSelect & { similarity: number }>> => {
		try {
			const { vector, limit, exclude } = input;
			const similaritySql = similarity(records.textEmbedding, vector);
			const results = await db
				.select({
					...getTableColumns(records),
					similarity: similaritySql,
				})
				.from(records)
				.where(
					and(
						isNotNull(records.textEmbedding),
						exclude ? notInArray(records.id, exclude) : undefined,
						eq(records.isPrivate, false)
					)
				)
				.orderBy((t) => [desc(t.similarity), desc(t.recordUpdatedAt)])
				.limit(limit);
			return results;
		} catch (error) {
			console.error(error);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for similar records',
			});
		}
	});
