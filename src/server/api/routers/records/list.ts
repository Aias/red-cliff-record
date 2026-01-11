import type { RelationsFieldFilter } from 'drizzle-orm';
import { publicProcedure } from '../../init';
import { ListRecordsInputSchema, type IdParamList } from '@/shared/types';

/**
 * Build a filter condition for the title column based on hasTitle and title text search.
 * - hasTitle=false → filter for null titles only
 * - hasTitle=true + title text → filter for non-null titles matching text
 * - hasTitle=true → filter for non-null titles
 * - title text only → filter for titles matching text (implicitly excludes nulls via ilike)
 * - title=null (from API, not CLI) → filter for null titles (backwards compat)
 */
function buildTitleFilter(
	hasTitle: boolean | undefined,
	title: string | null | undefined
): RelationsFieldFilter<string> | undefined {
	if (hasTitle === false) return { isNull: true };
	if (hasTitle === true && title) return { isNotNull: true, ilike: `%${title}%` };
	if (hasTitle === true) return { isNotNull: true };
	if (title === null) return { isNull: true };
	if (title) return { ilike: `%${title}%` };
	return undefined;
}

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
				hasTitle,
				minRating,
				maxRating,
				isPrivate,
				isCurated,
				hasReminder,
				hasEmbedding,
				hasMedia,
				sources,
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
				title: buildTitleFilter(hasTitle, title),
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
