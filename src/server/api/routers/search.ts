import {
  PREDICATES,
  RecordTypeSchema,
  type IntegrationType,
  type MediaType,
  type PredicateSlug,
  type RecordType,
} from '@hozo';
import { TRPCError } from '@trpc/server';
import { cosineDistance, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  exactMatchTier,
  ftsRank,
  lexicalMatchCondition,
  normalizedUrlColumn,
  normalizeUrl,
  setTrigramThresholds,
  similarity,
  SIMILARITY_THRESHOLD,
  trigramDistance,
  URL_DUPLICATE_CANDIDATE_LIMIT,
} from '@/server/lib/constants';
import { createEmbedding } from '@/server/lib/create-embedding';
import { IdSchema, SearchRecordsInputSchema } from '@/shared/types/api';
import { createTRPCRouter, publicProcedure } from '../init';

/** Predicate slugs for relevant link types in search results */
const searchLinkPredicates = Object.values(PREDICATES)
  .filter((p) => ['containment', 'creation', 'description', 'identity'].includes(p.type))
  .map((p) => p.slug);

/** Predicate slugs that are NOT containment (for filtering "standalone" records) */
const nonContainmentPredicates = Object.values(PREDICATES)
  .filter((p) => p.type !== 'containment')
  .map((p) => p.slug);

type SearchResult = {
  id: number;
  type: RecordType;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  sense?: string | null;
  abbreviation?: string | null;
  url?: string | null;
  avatarUrl?: string | null;
  rating: number;
  recordUpdatedAt: Date;
  recordCreatedAt: Date;
  contentCreatedAt?: Date | null;
  contentUpdatedAt?: Date | null;
  sources?: IntegrationType[] | null;
  mediaCaption?: string | null;
  media: {
    id: number;
    type: MediaType;
    url: string;
    altText?: string | null;
  }[];
  outgoingLinks: {
    id: number;
    predicate: PredicateSlug;
    target: {
      id: number;
      type: RecordType;
      title?: string | null;
      abbreviation?: string | null;
      sense?: string | null;
      summary?: string | null;
      avatarUrl?: string | null;
    };
  }[];
  similarity?: number;
};

export const searchRouter = createTRPCRouter({
  byTextQuery: publicProcedure
    .input(SearchRecordsInputSchema)
    .query(async ({ ctx: { db }, input }): Promise<SearchResult[]> => {
      const {
        query,
        filters: { recordType },
        limit,
      } = input;
      return db.transaction(async (tx) => {
        await setTrigramThresholds(tx);
        return tx.query.records.findMany({
          where: {
            RAW: (records) => lexicalMatchCondition(records, query),
            type: recordType,
          },
          limit,
          orderBy: (records, { desc }) => [
            exactMatchTier(records, query),
            desc(ftsRank(records.textSearch, query)),
            trigramDistance(records, query),
            desc(records.recordUpdatedAt),
          ],
          columns: {
            id: true,
            type: true,
            title: true,
            content: true,
            summary: true,
            sense: true,
            abbreviation: true,
            url: true,
            avatarUrl: true,
            mediaCaption: true,
            rating: true,
            recordUpdatedAt: true,
            recordCreatedAt: true,
            contentCreatedAt: true,
            contentUpdatedAt: true,
            sources: true,
            textEmbedding: false,
            textSearch: false,
          },
          with: {
            outgoingLinks: {
              columns: {
                id: true,
                predicate: true,
              },
              with: {
                target: {
                  columns: {
                    id: true,
                    type: true,
                    title: true,
                    abbreviation: true,
                    sense: true,
                    summary: true,
                    avatarUrl: true,
                  },
                },
              },
              where: {
                predicate: {
                  in: searchLinkPredicates,
                },
              },
            },
            media: {
              columns: {
                id: true,
                type: true,
                url: true,
                altText: true,
              },
            },
          },
        });
      });
    }),

  byVector: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().optional().default(20),
        exclude: z.number().array().optional(),
      })
    )
    .query(async ({ ctx: { db }, input }) => {
      try {
        const { query, limit, exclude } = input;
        const vector = await createEmbedding(query);

        return await db.query.records.findMany({
          columns: { id: true },
          where: {
            AND: [
              { textEmbedding: { isNotNull: true } },
              exclude?.length ? { id: { notIn: exclude } } : {},
              { isPrivate: false },
            ],
          },
          orderBy: (t) => [cosineDistance(t.textEmbedding, vector)],
          limit,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error searching for similar records',
          cause: err,
        });
      }
    }),

  byRecordId: publicProcedure
    .input(
      z.object({
        id: IdSchema,
        limit: z.number().optional().default(20),
        type: RecordTypeSchema.optional(),
      })
    )
    .query(async ({ ctx: { db }, input: { id, limit, type } }) => {
      try {
        const recordWithLinks = await db.query.records.findFirst({
          columns: {
            id: true,
            textEmbedding: true,
            url: true,
          },
          where: {
            id,
          },
          with: {
            outgoingLinks: {
              columns: {
                targetId: true,
              },
            },
            incomingLinks: {
              columns: {
                sourceId: true,
              },
            },
          },
        });
        if (!recordWithLinks) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Record not found' });
        }
        const { textEmbedding, url, outgoingLinks, incomingLinks } = recordWithLinks;

        if (textEmbedding === null) {
          return [];
        }

        const omittedIds = [
          id,
          ...outgoingLinks.map((l) => l.targetId),
          ...incomingLinks.map((l) => l.sourceId),
        ];

        // A shared source URL is a near-certain duplicate signal, but only
        // when the URL is distinctive — platform root URLs shared by dozens
        // of records carry no identity information, so those are suppressed
        // rather than truncated to an arbitrary few.
        const seedUrl = normalizeUrl(url);
        const urlMatches = seedUrl
          ? await db.query.records.findMany({
              columns: { id: true },
              where: {
                AND: [
                  { id: { notIn: omittedIds } },
                  { isPrivate: false },
                  { RAW: (t) => sql`${normalizedUrlColumn(t.url)} = ${seedUrl}` },
                ],
              },
              limit: URL_DUPLICATE_CANDIDATE_LIMIT + 1,
            })
          : [];
        const urlCandidateIds =
          urlMatches.length > 0 && urlMatches.length <= URL_DUPLICATE_CANDIDATE_LIMIT
            ? urlMatches.map((r) => r.id)
            : [];

        return await db.query.records.findMany({
          columns: { id: true },
          extras: {
            similarity: (t) => similarity(t.textEmbedding, textEmbedding),
          },
          where: {
            AND: [
              { textEmbedding: { isNotNull: true } },
              { id: { notIn: omittedIds } },
              { isPrivate: false },
              type ? { type } : {},
              {
                OR: [
                  ...(urlCandidateIds.length > 0 ? [{ id: { in: urlCandidateIds } }] : []),
                  {
                    RAW: (t, { sql }) =>
                      sql`1 - (${cosineDistance(t.textEmbedding, textEmbedding)}) > ${SIMILARITY_THRESHOLD}`,
                  },
                  {
                    outgoingLinks: {
                      predicate: {
                        in: nonContainmentPredicates,
                      },
                    },
                  },
                  {
                    incomingLinks: {
                      id: {
                        isNotNull: true,
                      },
                    },
                  },
                ],
              },
            ],
          },
          orderBy: (t, { desc }) => [
            ...(urlCandidateIds.length > 0 ? [desc(inArray(t.id, urlCandidateIds))] : []),
            desc(sql`similarity`),
            desc(t.recordUpdatedAt),
          ],
          limit,
        });
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error searching for similar records',
          cause: err,
        });
      }
    }),
});
