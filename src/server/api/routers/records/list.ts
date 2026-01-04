import { publicProcedure } from '../../init';
import { ListRecordsInputSchema, type IdParamList } from '@/shared/types';

export const list = publicProcedure
	.input(ListRecordsInputSchema)
	.query(async ({ ctx: { db }, input }): Promise<IdParamList> => {
		const {
			filters: {
				types,
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
				sources,
				created,
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
				type: types?.length ? { in: types } : undefined,
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
				sources: sources?.length
					? {
							arrayOverlaps: sources,
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
				recordCreatedAt:
					created?.from || created?.to
						? {
								// from: start of day (inclusive)
								gte: created.from ? new Date(`${created.from}T00:00:00Z`) : undefined,
								// to: start of next day (exclusive) to include entire day
								lt: created.to
									? new Date(new Date(`${created.to}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
									: undefined,
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
