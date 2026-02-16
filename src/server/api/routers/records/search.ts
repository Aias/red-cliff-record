import { containmentPredicateSlugs, PREDICATES } from '@hozo';
import { cosineDistance } from 'drizzle-orm';
import type { z } from 'zod';
import { createEmbedding } from '@/lib/server/create-embedding';
import { SIMILARITY_THRESHOLD } from '@/server/lib/constants';
import { HybridSearchInputSchema, type RecordFiltersSchema } from '@/shared/types/api';
import { publicProcedure } from '../../init';

const SEARCH_CAP = 200;
const RRF_K = 60;

/** Typed filter literals — Drizzle requires `true` (not `boolean`) for isNull/isNotNull */
const NOT_NULL = { isNotNull: true } as const;
const IS_NULL = { isNull: true } as const;

/** Preserve literal `true` types for Drizzle column selection */
function cols<T extends Record<string, true>>(c: T): T {
  return c;
}

/** Predicate slugs for relevant link types in search results */
const searchLinkPredicates = Object.values(PREDICATES)
  .filter((p) => ['containment', 'creation', 'description', 'identity'].includes(p.type))
  .map((p) => p.slug);

/** Columns returned for search results (grid + cmd+K) */
const searchColumns = cols({
  id: true,
  type: true,
  title: true,
  summary: true,
  content: true,
  sense: true,
  abbreviation: true,
  url: true,
  avatarUrl: true,
  mediaCaption: true,
  rating: true,
  recordCreatedAt: true,
  recordUpdatedAt: true,
  contentCreatedAt: true,
  contentUpdatedAt: true,
  sources: true,
});

/** Shared relation config for outgoing links in search results */
const outgoingLinksWith = {
  columns: cols({ id: true, predicate: true }),
  with: {
    target: {
      columns: cols({
        id: true,
        type: true,
        title: true,
        abbreviation: true,
        sense: true,
        summary: true,
        avatarUrl: true,
      }),
    },
  },
  where: {
    predicate: { in: searchLinkPredicates },
  },
} as const;

/** Shared relation config for media in search results */
const mediaWith = {
  columns: cols({ id: true, type: true, url: true, altText: true }),
} as const;

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
  .query(async ({ ctx: { db }, input }) => {
    const { query, filters, limit, offset, orderBy } = input;
    const filterWhere = buildFilterWhere(filters);

    if (!query) {
      // Non-search: filtered list with full row data
      const items = await db.query.records.findMany({
        columns: searchColumns,
        with: { outgoingLinks: outgoingLinksWith, media: mediaWith },
        where: filterWhere,
        limit,
        offset,
        orderBy: (records, { asc, desc }) =>
          orderBy.map(({ field, direction }) => {
            const col = records[field];
            return direction === 'asc' ? asc(col) : desc(col);
          }),
      });
      return { items };
    }

    // Hybrid search: trigram + vector → RRF merge
    // Start both concurrently — both promises created before either is awaited
    const trigramPromise = db.query.records.findMany({
      columns: searchColumns,
      with: { outgoingLinks: outgoingLinksWith, media: mediaWith },
      where: {
        ...filterWhere,
        RAW: (records, { sql }) =>
          sql`(
            ${records.title} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
            ${records.content} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
            ${records.summary} <-> ${query} < ${SIMILARITY_THRESHOLD} OR
            ${records.abbreviation} <-> ${query} < ${SIMILARITY_THRESHOLD}
          )`,
      },
      orderBy: (records, { sql }) => [
        sql`LEAST(
          ${records.title} <-> ${query},
          ${records.content} <-> ${query},
          ${records.summary} <-> ${query},
          ${records.abbreviation} <-> ${query}
        )`,
      ],
      limit: SEARCH_CAP,
    });

    const vectorPromise = createEmbedding(query).then((vector) =>
      db.query.records.findMany({
        columns: searchColumns,
        with: { outgoingLinks: outgoingLinksWith, media: mediaWith },
        where: {
          ...filterWhere,
          textEmbedding: NOT_NULL,
        },
        orderBy: (records) => [cosineDistance(records.textEmbedding, vector)],
        limit: SEARCH_CAP,
      })
    );

    const trigramResults = await trigramPromise;
    let vectorResults: typeof trigramResults = [];
    try {
      vectorResults = await vectorPromise;
    } catch {
      // Vector search failed (embedding API error), continue with text-only results
    }

    return { items: rrfMerge(trigramResults, vectorResults).slice(0, SEARCH_CAP) };
  });
