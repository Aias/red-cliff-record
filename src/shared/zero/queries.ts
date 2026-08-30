import { containmentPredicateSlugs, creationContainmentPredicateSlugs } from '@hozo';
import { RecordTypeSchema } from '@hozo/schema/records.shared';
import { defineQueries, defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { IdSchema, LimitSchema, OrderBySchema } from '@/shared/types/api';
import { zql } from './schema.gen';

const IdArgsSchema = z.object({ id: IdSchema });

/**
 * The browse-mode filter surface: every `records.list` filter expressible in
 * client-side ZQL. Search (tsvector/pgvector) and `hasEmbedding` (unsynced
 * column) stay server-side; `sources` overlap and `hasParent`/`hasMedia`
 * (negation needs NOT EXISTS, unsupported in client ZQL) are filtered in JS
 * over the related rows the query already loads.
 */
const BrowseRecordsArgsSchema = z.object({
  types: z.array(RecordTypeSchema).optional(),
  hasTitle: z.boolean().optional(),
  minElo: z.number().int().optional(),
  maxElo: z.number().int().optional(),
  isPrivate: z.boolean().optional(),
  isCurated: z.boolean().optional(),
  hasReminder: z.boolean().optional(),
  orderBy: OrderBySchema,
  limit: LimitSchema.optional(),
});

export const queries = defineQueries({
  /** Single record with media and its creation/containment edges (title fallback chain). */
  record: defineQuery(IdArgsSchema, ({ args: { id } }) =>
    zql.records
      .where('id', id)
      .related('media')
      .related('outgoingLinks', (q) =>
        q
          .where('predicate', 'IN', creationContainmentPredicateSlugs)
          .related('target', (t) => t.one())
      )
      .one()
  ),
  /** Batch variant of `record` for list views. */
  recordsByIds: defineQuery(z.object({ ids: z.array(IdSchema) }), ({ args: { ids } }) =>
    zql.records
      .where('id', 'IN', ids)
      .related('media')
      .related('outgoingLinks', (q) =>
        q
          .where('predicate', 'IN', creationContainmentPredicateSlugs)
          .related('target', (t) => t.one())
      )
  ),
  /** All links touching a record, with the neighbor record on each edge. */
  recordLinks: defineQuery(IdArgsSchema, ({ args: { id } }) =>
    zql.records
      .where('id', id)
      .related('outgoingLinks', (q) => q.related('target', (t) => t.one()))
      .related('incomingLinks', (q) => q.related('source', (s) => s.one()))
      .one()
  ),
  /** Containment family: parent (with grandparents and siblings) and children. */
  recordTree: defineQuery(IdArgsSchema, ({ args: { id } }) =>
    zql.records
      .where('id', id)
      .related('outgoingLinks', (q) =>
        q.where('predicate', 'IN', containmentPredicateSlugs).related('target', (t) =>
          t
            .one()
            .related('outgoingLinks', (tq) =>
              tq
                .where('predicate', 'IN', containmentPredicateSlugs)
                .related('target', (tt) => tt.one())
            )
            .related('incomingLinks', (tq) =>
              tq
                .where('predicate', 'IN', containmentPredicateSlugs)
                .related('source', (ts) => ts.one())
            )
        )
      )
      .related('incomingLinks', (q) =>
        q.where('predicate', 'IN', containmentPredicateSlugs).related('source', (s) => s.one())
      )
      .one()
  ),
  /** Filtered, ordered record list for browse mode (non-search `records.list`). */
  browseRecords: defineQuery(BrowseRecordsArgsSchema, ({ args }) => {
    let q = zql.records
      .related('media')
      .related('outgoingLinks', (oq) =>
        oq
          .where('predicate', 'IN', creationContainmentPredicateSlugs)
          .related('target', (t) => t.one())
      );
    if (args.types?.length) q = q.where('type', 'IN', args.types);
    if (args.isPrivate !== undefined) q = q.where('isPrivate', args.isPrivate);
    if (args.isCurated !== undefined) {
      q = q.where('recordCuratedAt', args.isCurated ? 'IS NOT' : 'IS', null);
    }
    if (args.hasTitle !== undefined) {
      q = q.where('title', args.hasTitle ? 'IS NOT' : 'IS', null);
    }
    if (args.hasReminder !== undefined) {
      q = q.where('reminderAt', args.hasReminder ? 'IS NOT' : 'IS', null);
    }
    if (args.minElo !== undefined) q = q.where('eloScore', '>=', args.minElo);
    if (args.maxElo !== undefined) q = q.where('eloScore', '<=', args.maxElo);
    for (const { field, direction } of args.orderBy) {
      q = q.orderBy(field, direction);
    }
    if (args.limit !== undefined) q = q.limit(args.limit);
    return q;
  }),
  /**
   * Matchup pool candidates: curated records of one type, with the structural
   * `contained_by` edges that disqualify child artifacts (negation needs NOT
   * EXISTS, unsupported in client ZQL, so callers filter in JS).
   */
  eloPool: defineQuery(z.object({ type: RecordTypeSchema }), ({ args: { type } }) =>
    zql.records
      .where('type', type)
      .where('recordCuratedAt', 'IS NOT', null)
      .related('outgoingLinks', (q) => q.where('predicate', 'contained_by'))
  ),
  /** ELO matchups a record has participated in (either side). */
  recordMatchups: defineQuery(IdArgsSchema, ({ args: { id } }) =>
    zql.eloMatchups.where(({ cmp, or }) => or(cmp('recordAId', id), cmp('recordBId', id)))
  ),
  /* Preload queries: the whole graph is small enough to sync entirely. */
  allRecords: defineQuery(() => zql.records),
  allLinks: defineQuery(() => zql.links),
  allMedia: defineQuery(() => zql.media),
  allEloMatchups: defineQuery(() => zql.eloMatchups),
});
