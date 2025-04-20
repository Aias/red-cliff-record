import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { IdSchema } from '../common';

const MATCH_THRESHOLD = 0.45;

/**
 * Weights for the composite distance score.
 * Sum to 1.0 so the result stays in [0, 1].
 */
const WEIGHT = {
	title: 0.45,
	url: 0.35,
	abbrVsTitle: 0.1, // abbreviation ↔ title
	titleVsAbbr: 0.05,
	senseVsTitle: 0.05,
};

export const findDuplicates = publicProcedure
	.input(IdSchema)
	.query(async ({ ctx: { db }, input }) => {
		/* 1. Fetch source record */
		const source = await db.query.records.findFirst({
			columns: {
				id: true,
				title: true,
				url: true,
				abbreviation: true,
				sense: true,
			},
			where: { id: input },
			with: { creators: true },
		});

		if (!source) {
			throw new TRPCError({
				code: 'NOT_FOUND',
				message: `Find duplicates: Record ${input} not found`,
			});
		}

		const { title, url, abbreviation, sense } = source;

		if (!title && !url && !abbreviation && !sense) {
			return [];
		}

		/* 3. Query & rank */
		return db.query.records.findMany({
			where: {
				id: { ne: input },
				NOT: {
					AND: [
						{
							url: {
								isNull: true,
							},
						},
						{
							title: {
								isNull: true,
							},
						},
						{
							abbreviation: {
								isNull: true,
							},
						},
						{
							sense: {
								isNull: true,
							},
						},
					],
				},
				OR: [
					url ? { url } : {},
					title ? { RAW: (r) => sql`${r.title} <-> ${title} < ${MATCH_THRESHOLD}` } : {},
					abbreviation && title
						? {
								RAW: (r) =>
									sql`LEAST(${r.title} <-> ${abbreviation},
														${r.abbreviation} <-> ${title}) < ${MATCH_THRESHOLD}`,
							}
						: {},
					sense ? { RAW: (r) => sql`${r.sense} <-> ${sense} < ${MATCH_THRESHOLD}` } : {},
				],
			},
			orderBy: (r, { sql, desc }) => [
				sql`(
					  ${WEIGHT.title}       * COALESCE(${r.title}       <-> ${title},        1) +
					  ${WEIGHT.url}         * COALESCE(${r.url}         <-> ${url},          1) +
					  ${WEIGHT.abbrVsTitle} * COALESCE(${r.abbreviation}<-> ${title},        1) +
					  ${WEIGHT.titleVsAbbr} * COALESCE(${r.title}       <-> ${abbreviation}, 1) +
					  ${WEIGHT.senseVsTitle}* COALESCE(${r.sense}       <-> ${title},        1)
				)`,
				desc(r.recordUpdatedAt),
			],
			limit: 3,
			with: {
				creators: {
					columns: {
						textEmbedding: false,
					},
				},
				format: {
					columns: {
						textEmbedding: false,
					},
				},
				media: true,
			},
			columns: {
				textEmbedding: false, // still omit embeddings
			},
		});
	});
