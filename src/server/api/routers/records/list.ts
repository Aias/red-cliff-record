import { publicProcedure } from '../../init';
import { type IdParamList } from '../common';
import { ListRecordsInputSchema } from '../types';

export const list = publicProcedure
	.input(ListRecordsInputSchema)
	.query(async ({ ctx: { db }, input }): Promise<IdParamList> => {
		const {
			filters: {
				type,
				title,
				text,
				url: domain,
				hasParent,
				minRating,
				maxRating,
				isPrivate,
				isCurated,
				hasReminder,
				hasEmbedding,
				hasMedia,
				source,
			},
			limit,
			offset,
			orderBy,
		} = input;

		const rows = await db.query.records.findMany({
			columns: {
				id: true,
			},
			where: {
				type,
				title:
					title === null
						? {
								isNull: true,
							}
						: title
							? {
									ilike: `%${title}%`,
								}
							: undefined,
				OR: text
					? [
							{
								content: { ilike: `%${text}%` },
							},
							{
								summary: { ilike: `%${text}%` },
							},
							{
								notes: { ilike: `%${text}%` },
							},
							{
								mediaCaption: { ilike: `%${text}%` },
							},
						]
					: undefined,
				url:
					domain === null
						? {
								isNull: true,
							}
						: domain
							? {
									ilike: `%${domain}%`,
								}
							: undefined,
				isPrivate,
				isCurated,
				...(hasParent === true
					? {
							outgoingLinks: {
								predicate: {
									type: 'containment',
								},
							},
						}
					: hasParent === false
						? {
								NOT: {
									outgoingLinks: {
										predicate: { type: 'containment' },
									},
								},
							}
						: {}),
				media: hasMedia,
				reminderAt: hasReminder
					? {
							isNotNull: true,
						}
					: {
							isNull: true,
						},
				sources: source
					? {
							arrayOverlaps: [source],
						}
					: undefined,
				rating:
					minRating || maxRating
						? {
								gte: minRating,
								lte: maxRating,
							}
						: undefined,
				textEmbedding:
					hasEmbedding === true
						? {
								isNotNull: true,
							}
						: hasEmbedding === false
							? {
									isNull: true,
								}
							: undefined,
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

		return {
			ids: rows.map((row) => ({ id: row.id })),
		};
	});
