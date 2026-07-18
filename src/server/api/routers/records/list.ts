import { containmentPredicateSlugs } from '@hozo';
import { cosineDistance, sql } from 'drizzle-orm';
import type { z } from 'zod';
import {
  exactMatchTier,
  ftsRank,
  lexicalMatchCondition,
  setTrigramThresholds,
  trigramDistance,
} from '@/server/lib/constants';
import { createEmbedding } from '@/server/lib/create-embedding';
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
    minElo,
    maxElo,
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
    eloScore: minElo || maxElo ? { gte: minElo, lte: maxElo } : undefined,
    textEmbedding: hasEmbedding === true ? NOT_NULL : hasEmbedding === false ? IS_NULL : undefined,
  };
}

function rrfMerge<T extends { id: number }>(...lists: { items: T[]; weight?: number }[]): T[] {
  const scores = new Map<number, { item: T; score: number }>();

  for (const { items, weight = 1 } of lists) {
    for (const [rank, item] of items.entries()) {
      const rrfScore = weight / (RRF_K + rank + 1);
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

    const runLexicalSearch = async () => {
      const effectiveLimit = strategy === 'hybrid' ? SEARCH_CAP : limit;
      return db.transaction(async (tx) => {
        await setTrigramThresholds(tx);
        return tx.query.records.findMany({
          columns: { id: true },
          extras: {
            exactTier: (records) => exactMatchTier(records, searchQuery).as('exact_tier'),
          },
          where: {
            ...filterWhere,
            RAW: (records) => lexicalMatchCondition(records, searchQuery),
          },
          orderBy: (records, { asc, desc }) => [
            exactMatchTier(records, searchQuery),
            desc(ftsRank(records.textSearch, searchQuery)),
            trigramDistance(records, searchQuery),
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
      const lexicalPromise = runLexicalSearch();
      const vectorPromise = runVectorSearch();

      const lexicalRows = await lexicalPromise;
      let vectorResults: { id: number }[] = [];
      try {
        vectorResults = await vectorPromise;
      } catch {
        // Vector search failed; keep text results only.
      }

      // Literal matches (exact/prefix/substring) get extra weight so they
      // can't be diluted below purely semantic neighbors in the fused ranking.
      const lexicalResults = lexicalRows.map(({ id }) => ({ id }));
      const literalResults = lexicalRows
        .filter((row) => row.exactTier <= 2)
        .map(({ id }) => ({ id }));

      // Offset is ignored here: merged rankings are not stable across requests.
      const merged = rrfMerge(
        { items: literalResults, weight: 2 },
        { items: lexicalResults },
        { items: vectorResults }
      );
      return { ids: merged.slice(0, limit) };
    };

    if (strategy === 'lexical') {
      const rows = await runLexicalSearch();
      return { ids: rows.map(({ id }) => ({ id })) };
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
