import { and, eq } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { SIMILARITY_THRESHOLD } from '../common';
import { SearchRecordsInputSchema } from '../records.types';

export const search = publicProcedure
	.input(SearchRecordsInputSchema)
	.query(({ ctx: { db }, input }) => {
		const {
			query,
			filters: { isFormat, isIndexNode },
			limit,
		} = input;
		return db.query.records.findMany({
			where: (records, { sql }) =>
				and(
					sql`(
			${records.title} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
			${records.content} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
			${records.notes} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
			${records.summary} <-> ${query} < ${SIMILARITY_THRESHOLD}
		)`,
					isFormat ? eq(records.isFormat, true) : undefined,
					isIndexNode ? eq(records.isIndexNode, true) : undefined
				),
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
				creators: {
					with: {
						creator: true,
					},
				},
				media: true,
			},
		});
	});
