import { containmentPredicateSlugs } from '@hozo';
import { cosineDistance, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { createEmbedding } from '@/lib/server/create-embedding';
import { TRIGRAM_DISTANCE_THRESHOLD } from '@/server/lib/constants';
import {
  HybridSearchInputSchema,
  type IdParamList,
  type RecordFiltersSchema,
} from '@/shared/types/api';
import { publicProcedure } from '../../init';

const SEARCH_CAP = 200;
const RRF_K = 60;

/** Typed filter literals — Drizzle requires `true` (not `boolean`) for isNull/isNotNull */
const NOT_NULL = { isNotNull: true } as const;
const IS_NULL = { isNull: true } as const;

/** Build Drizzle where clause from sidebar filters */
function buildFilterWhere(filters: z.infer<typeof RecordFiltersSchema>) {
  const {
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
  } = filters;

  return {
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
    textEmbedding: hasEmbedding === true ? NOT_NULL : hasEmbedding === false ? IS_NULL : undefined,
  };
}

/** Reciprocal Rank Fusion: merge ranked lists by position, not score */
function rrfMerge<T extends { id: number }>(...lists: T[][]): T[] {
  const scores = new Map<number, { item: T; score: number }>();

  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank]!;
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scores.get(item.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scores.set(item.id, { item, score: rrfScore });
      }
    }
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).map(({ item }) => item);
}

export const search = publicProcedure
  .input(HybridSearchInputSchema)
  .query(async ({ ctx: { db }, input }): Promise<IdParamList> => {
    const { query, filters, limit, offset, orderBy } = input;
    const filterWhere = buildFilterWhere(filters);

    if (!query) {
      const rows = await db.query.records.findMany({
        columns: { id: true },
        where: filterWhere,
        limit,
        offset,
        orderBy: (records, { asc, desc }) =>
          orderBy.map(({ field, direction }) => {
            const col = records[field];
            return direction === 'asc' ? asc(col) : desc(col);
          }),
      });
      return { ids: rows };
    }

    const { strategy } = input;

    const findTrigram = () => {
      const effectiveLimit = strategy === 'hybrid' ? SEARCH_CAP : limit;
      const similarityThreshold = String(1 - TRIGRAM_DISTANCE_THRESHOLD);
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('pg_trgm.similarity_threshold', ${similarityThreshold}, true)`
        );
        return tx.query.records.findMany({
          columns: { id: true },
          where: {
            ...filterWhere,
            RAW: (records, { sql }) =>
              sql`(
                ${records.title} % ${query} OR
                ${records.content} % ${query} OR
                ${records.summary} % ${query} OR
                ${records.abbreviation} % ${query}
              )`,
          },
          orderBy: (records, { sql, asc }) => [
            sql`LEAST(
              ${records.title} <-> ${query},
              ${records.content} <-> ${query},
              ${records.summary} <-> ${query},
              ${records.abbreviation} <-> ${query}
            )`,
            asc(sql`length(${records.title})`),
          ],
          limit: effectiveLimit,
        });
      });
    };

    const findVector = async () => {
      const vector = await createEmbedding(query);
      const effectiveLimit = strategy === 'hybrid' ? SEARCH_CAP : limit;
      return db.transaction(async (tx) => {
        // Ensure ef_search is applied on the same session as the vector query.
        await tx.execute(sql`SELECT set_config('hnsw.ef_search', ${String(effectiveLimit)}, true)`);
        return tx.query.records.findMany({
          columns: { id: true },
          where: {
            ...filterWhere,
            textEmbedding: NOT_NULL,
          },
          orderBy: (records) => [cosineDistance(records.textEmbedding, vector)],
          limit: effectiveLimit,
        });
      });
    };

    if (strategy === 'trigram') {
      return { ids: await findTrigram() };
    }

    if (strategy === 'vector') {
      try {
        return { ids: await findVector() };
      } catch {
        return { ids: [] };
      }
    }

    const trigramPromise = findTrigram();
    const vectorPromise = findVector();

    const trigramResults = await trigramPromise;
    let vectorResults: typeof trigramResults = [];
    try {
      vectorResults = await vectorPromise;
    } catch {
      // Vector search failed — continue with text-only results
    }

    return { ids: rrfMerge(trigramResults, vectorResults).slice(0, limit) };
  });
