import { containmentPredicateSlugs } from '@hozo';
import { ListRecordsInputSchema, type IdParamList } from '@/shared/types/api';
import { publicProcedure } from '../../init';

const NOT_NULL = { isNotNull: true } as const;
const IS_NULL = { isNull: true } as const;

export const list = publicProcedure
  .input(ListRecordsInputSchema)
  .query(async ({ ctx: { db }, input }): Promise<IdParamList> => {
    const {
      filters: {
        types,
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
        title: hasTitle === true ? NOT_NULL : hasTitle === false ? IS_NULL : undefined,
        isPrivate,
        isCurated,
        ...(hasParent === true
          ? { outgoingLinks: { predicate: { in: containmentPredicateSlugs } } }
          : hasParent === false
            ? { NOT: { outgoingLinks: { predicate: { in: containmentPredicateSlugs } } } }
            : {}),
        media: hasMedia,
        reminderAt: hasReminder === true ? NOT_NULL : hasReminder === false ? IS_NULL : undefined,
        sources: sources?.length ? { arrayOverlaps: sources } : undefined,
        rating: minRating || maxRating ? { gte: minRating, lte: maxRating } : undefined,
        textEmbedding:
          hasEmbedding === true ? NOT_NULL : hasEmbedding === false ? IS_NULL : undefined,
      },
      limit,
      offset,
      orderBy: (records, { asc, desc }) =>
        orderBy.map(({ field, direction }) => {
          const col = records[field];
          return direction === 'asc' ? asc(col) : desc(col);
        }),
    });

    return {
      ids: rows.map((row) => ({ id: row.id })),
    };
  });
