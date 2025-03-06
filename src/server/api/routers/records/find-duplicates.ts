import { TRPCError } from '@trpc/server';
import { isNotNull } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { SIMILARITY_THRESHOLD } from '../common';
import { IdSchema } from '../records.types';

export const findDuplicates = publicProcedure
	.input(IdSchema)
	.query(async ({ ctx: { db }, input }) => {
		// 1) Fetch the source record by ID
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
			throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
		}

		const { title, url, content, summary, notes, abbreviation, sense } = sourceRecord;

		// 2) Build a WHERE clause:
		//    - Exclude the source record itself
		//    - OR conditions for URL =, or text columns that are "similar" below a threshold
		return db.query.records.findMany({
			where: (records, { eq, ne, or, and, sql }) => {
				const orConditions = [];

				// Exact URL match (if url is present)
				if (url) {
					orConditions.push(eq(records.url, url));
				}

				// Title similarity
				if (title) {
					orConditions.push(sql`${records.title} <-> ${title} < ${SIMILARITY_THRESHOLD}`);
				}

				// Abbreviation similarity
				if (abbreviation) {
					orConditions.push(
						sql`${records.abbreviation} <-> ${abbreviation} < ${SIMILARITY_THRESHOLD}`
					);
				}

				// Sense similarity
				if (sense) {
					orConditions.push(sql`${records.sense} <-> ${sense} < ${SIMILARITY_THRESHOLD}`);
				}

				// Content similarity
				if (content) {
					orConditions.push(sql`${records.content} <-> ${content} < ${SIMILARITY_THRESHOLD}`);
				}

				// Summary similarity
				if (summary) {
					orConditions.push(sql`${records.summary} <-> ${summary} < ${SIMILARITY_THRESHOLD}`);
				}

				// Notes similarity
				if (notes) {
					orConditions.push(sql`${records.notes} <-> ${notes} < ${SIMILARITY_THRESHOLD}`);
				}

				// AND conditions
				const andConditions = [
					// Exclude current record
					ne(records.id, input),
					// Exclude "partials" (record fragments)
					isNotNull(records.title),
					// We only combine OR-conditions if there's something to compare
					orConditions.length ? or(...orConditions) : undefined,
				].filter(Boolean);

				return and(...andConditions);
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
			limit: 5, // Adjust as needed
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
