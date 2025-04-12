import { publicProcedure } from '../../init';
import { ListRecordsInputSchema, type RecordWithRelations } from '../records.types';

export const list = publicProcedure
	.input(ListRecordsInputSchema)
	.query(async ({ ctx: { db }, input }): Promise<RecordWithRelations[]> => {
		const {
			filters: {
				type,
				title,
				text,
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
				creators: true,
				format: true,
				parent: true,
				media: true,
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
				formatId:
					formatId === null
						? {
								isNull: true,
							}
						: formatId,
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
				parentId:
					parentId === null || hasParent === false
						? {
								isNull: true,
							}
						: hasParent
							? {
									isNotNull: true,
								}
							: parentId,
				isIndexNode,
				isFormat,
				isPrivate,
				isCurated,
				creators: creatorId
					? {
							id: creatorId,
						}
					: undefined,
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
