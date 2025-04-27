import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { publicProcedure } from '../../init';
import { IdSchema, similarity, SIMILARITY_THRESHOLD } from '../common';
import { SearchRecordsInputSchema } from '../records.types';

export const byTextQuery = publicProcedure
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
				outgoingLinks: {
					with: {
						predicate: true,
						target: {
							columns: {
								textEmbedding: false,
							},
						},
					},
					limit: 5,
				},
				media: true,
			},
		});
	});

export const byVector = publicProcedure
	.input(
		z.object({
			vector: z.number().array(),
			limit: z.number().optional().default(20),
			exclude: z.number().array().optional(),
		})
	)
	.query(async ({ ctx: { db }, input }) => {
		try {
			const { vector, limit, exclude } = input;

			const results = await db.query.records.findMany({
				with: {
					outgoingLinks: {
						with: {
							predicate: true,
							target: {
								columns: {
									textEmbedding: false,
								},
							},
						},
						limit: 5,
					},
					media: true,
				},
				columns: {
					textEmbedding: false,
				},
				extras: {
					similarity: (t) => similarity(t.textEmbedding, vector),
				},
				where: {
					AND: [
						{ textEmbedding: { isNotNull: true } },
						exclude?.length ? { id: { notIn: exclude } } : {},
						{ isPrivate: false },
						{
							OR: [
								{
									outgoingLinks: {
										predicate: {
											type: {
												ne: 'containment',
											},
										},
									},
								},
								{
									incomingLinks: {
										id: {
											isNotNull: true,
										},
									},
								},
							],
						},
					],
				},
				orderBy: (t, { desc }) => [desc(sql`similarity`), desc(t.recordUpdatedAt)],
				limit,
			});

			return results; // typed as (RecordSelect & { similarity: number })[]
		} catch (err) {
			console.error(err);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for similar records',
			});
		}
	});

export const byRecordId = publicProcedure
	.input(
		z.object({
			id: IdSchema,
			limit: z.number().optional().default(20),
		})
	)
	.query(async ({ ctx: { db }, input: { id, limit } }) => {
		try {
			const recordWithLinks = await db.query.records.findFirst({
				columns: {
					id: true,
					textEmbedding: true,
				},
				where: {
					id,
				},
				with: {
					outgoingLinks: {
						columns: {
							targetId: true,
						},
					},
					incomingLinks: {
						columns: {
							sourceId: true,
						},
					},
				},
			});
			if (!recordWithLinks) {
				throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
			}
			const { textEmbedding, outgoingLinks, incomingLinks } = recordWithLinks;

			if (textEmbedding === null) {
				return [];
			}

			const omittedIds = [
				id,
				...outgoingLinks.map((l) => l.targetId),
				...incomingLinks.map((l) => l.sourceId),
			];

			const results = await db.query.records.findMany({
				columns: {
					id: true,
				},
				extras: {
					similarity: (t) => similarity(t.textEmbedding, textEmbedding),
				},
				where: {
					AND: [
						{ textEmbedding: { isNotNull: true } },
						{ id: { notIn: omittedIds } },
						{ isPrivate: false },
						{
							OR: [
								{
									outgoingLinks: {
										predicate: {
											type: {
												ne: 'containment',
											},
										},
									},
								},
								{
									incomingLinks: {
										id: {
											isNotNull: true,
										},
									},
								},
							],
						},
					],
				},
				orderBy: (t, { desc }) => [desc(sql`similarity`), desc(t.recordUpdatedAt)],
				limit,
			});

			return results;
		} catch (err) {
			console.error(err);
			throw new TRPCError({
				code: 'INTERNAL_SERVER_ERROR',
				message: 'Error searching for similar records',
			});
		}
	});
