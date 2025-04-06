import { arrayOverlaps } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { ListRecordsInputSchema } from '../records.types';

export const list = publicProcedure
	.input(ListRecordsInputSchema)
	.query(async ({ ctx: { db }, input }) => {
		const {
			filters: {
				type,
				title,
				creatorId,
				formatId,
				url: domain,
				parentId,
				hasParent,
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

				if (hasParent !== undefined) {
					if (hasParent) {
						whereClauses.push(isNotNull(records.parentId));
					} else {
						whereClauses.push(isNull(records.parentId));
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
