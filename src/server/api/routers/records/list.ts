import { containmentPredicateSlugs } from '@hozo';
import { cosineDistance, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { createEmbedding } from '@/lib/server/create-embedding';
import { TRIGRAM_DISTANCE_THRESHOLD } from '@/server/lib/constants';
import {
  ListRecordsInputSchema,
  type IdParamList,
  type RecordFiltersSchema,
} from '@/shared/types/api';
import { publicProcedure } from '../../init';

const SEARCH_CAP = 200;
const RRF_K = 60;

const NOT_NULL = { isNotNull: true } as const;
const IS_NULL = { isNull: true } as const;

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

export const list = publicProcedure
  .input(ListRecordsInputSchema)
  .query(async ({ ctx: { db }, input }): Promise<IdParamList> => {
    const { searchQuery, filters, limit, offset, orderBy } = input;
    const strategy = input.strategy ?? 'hybrid';
    const filterWhere = buildFilterWhere(filters);

    const runFilteredList = async (): Promise<IdParamList> => {
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
    };

    if (!searchQuery) {
      return runFilteredList();
    }

    const runTrigramSearch = async () => {
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
                ${records.title} % ${searchQuery} OR
                ${records.content} % ${searchQuery} OR
                ${records.summary} % ${searchQuery} OR
                ${records.abbreviation} % ${searchQuery}
              )`,
          },
          orderBy: (records, { sql, asc }) => [
            sql`LEAST(
              ${records.title} <-> ${searchQuery},
              ${records.content} <-> ${searchQuery},
              ${records.summary} <-> ${searchQuery},
              ${records.abbreviation} <-> ${searchQuery}
            )`,
            asc(sql`length(${records.title})`),
          ],
          limit: effectiveLimit,
        });
      });
    };

    const runVectorSearch = async () => {
      const vector = await createEmbedding(searchQuery);
      const effectiveLimit = strategy === 'hybrid' ? SEARCH_CAP : limit;
      return db.transaction(async (tx) => {
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

    const runHybridSearch = async (): Promise<IdParamList> => {
      const trigramPromise = runTrigramSearch();
      const vectorPromise = runVectorSearch();

      const trigramResults = await trigramPromise;
      let vectorResults: typeof trigramResults = [];
      try {
        vectorResults = await vectorPromise;
      } catch {
        // Vector search failed; keep text results only.
      }

      // Offset is ignored here: merged rankings are not stable across requests.
      return { ids: rrfMerge(trigramResults, vectorResults).slice(0, limit) };
    };

    if (strategy === 'trigram') {
      return { ids: await runTrigramSearch() };
    }

    if (strategy === 'vector') {
      try {
        return { ids: await runVectorSearch() };
      } catch {
        return { ids: [] };
      }
    }

    return runHybridSearch();
  });
