import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { SIMILARITY_THRESHOLD } from '../common';
import { IdSchema } from '../common';

export const findDuplicates = publicProcedure
	.input(IdSchema)
	.query(async ({ ctx: { db }, input }) => {
		// 1) Fetch the source record by ID
		const sourceRecord = await db.query.records.findFirst({
			where: {
				id: input,
			},
			with: {
				creators: {
					with: {
						creator: true,
					},
				},
			},
		});

		if (!sourceRecord) {
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
		}

		const { title, url, content, summary, notes, abbreviation, sense } = sourceRecord;

		// 2) Build a WHERE clause:
		//    - Exclude the source record itself
		//    - OR conditions for URL =, or text columns that are "similar" below a threshold
		return db.query.records.findMany({
			where: {
				OR: [
					url ? { url } : {},
					title
						? { RAW: (records) => sql`${records.title} <-> ${title} < ${SIMILARITY_THRESHOLD}` }
						: {},
					content
						? { RAW: (records) => sql`${records.content} <-> ${content} < ${SIMILARITY_THRESHOLD}` }
						: {},
					summary
						? { RAW: (records) => sql`${records.summary} <-> ${summary} < ${SIMILARITY_THRESHOLD}` }
						: {},
					notes
						? { RAW: (records) => sql`${records.notes} <-> ${notes} < ${SIMILARITY_THRESHOLD}` }
						: {},
					abbreviation
						? {
								RAW: (records) =>
									sql`${records.abbreviation} <-> ${abbreviation} < ${SIMILARITY_THRESHOLD}`,
							}
						: {},
					sense
						? { RAW: (records) => sql`${records.sense} <-> ${sense} < ${SIMILARITY_THRESHOLD}` }
						: {},
				],
				id: {
					ne: input,
				},
				title: {
					isNotNull: true,
				},
			},

			// 3) Order by combined similarity measure first (lowest distance = best match),
			//    then perhaps by updated date
			orderBy: (records, { sql, desc }) => [
				// You can adjust which columns go into this LEAST() calculation
				sql`LEAST(
          COALESCE(${records.title} <-> ${title || ''}, 1),
          COALESCE(${records.content} <-> ${content || ''}, 1),
          COALESCE(${records.summary} <-> ${summary || ''}, 1),
          COALESCE(${records.notes} <-> ${notes || ''}, 1),
          COALESCE(${records.abbreviation} <-> ${abbreviation || ''}, 1),
          COALESCE(${records.sense} <-> ${sense || ''}, 1)
        )`,
				desc(records.recordUpdatedAt),
			],
			limit: 3, // Adjust as needed
			with: {
				creators: {
					with: {
						creator: true,
					},
				},
				media: true,
				format: true,
			},
		});
	});
