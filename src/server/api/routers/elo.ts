import { eloMatchups, records, type RecordType } from '@hozo';
import { TRPCError } from '@trpc/server';
import { count, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/server/db/connections/postgres';
import { eloDeltas } from '@/server/lib/elo';
import {
  GetMatchupInputSchema,
  GetOpponentsInputSchema,
  SubmitMatchupInputSchema,
  type DbId,
} from '@/shared/types/api';
import { createTRPCRouter, publicProcedure } from '../init';

type Queryable = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

const OPPONENT_WINDOWS = [200, 400, 800, 1600, Infinity];
const WILDCARD_PROBABILITY = 0.15;
/** A record with fewer matchups than this gets anchored against established opponents. */
const PROVISIONAL_MATCHUPS = 10;

async function matchupCounts(db: Queryable, ids: DbId[]): Promise<Map<DbId, number>> {
  if (ids.length === 0) return new Map();
  const [asA, asB] = await Promise.all([
    db
      .select({ id: eloMatchups.recordAId, n: count() })
      .from(eloMatchups)
      .where(inArray(eloMatchups.recordAId, ids))
      .groupBy(eloMatchups.recordAId),
    db
      .select({ id: eloMatchups.recordBId, n: count() })
      .from(eloMatchups)
      .where(inArray(eloMatchups.recordBId, ids))
      .groupBy(eloMatchups.recordBId),
  ]);
  const counts = new Map(ids.map((id) => [id, 0]));
  for (const { id, n } of [...asA, ...asB]) {
    counts.set(id, (counts.get(id) ?? 0) + n);
  }
  return counts;
}

/**
 * The matchup pool: curated records of one type, and for artifacts only those
 * at the root level. An artifact contained by a parent (a highlight, an
 * excerpt) is ranked through its parent, not on its own — the `contained_by`
 * predicate specifically; citation links like quotes don't demote a record.
 * Concepts and entities always stand alone.
 */
function poolWhere(type: RecordType) {
  return {
    type,
    isCurated: true,
    ...(type === 'artifact'
      ? { NOT: { outgoingLinks: { predicate: 'contained_by' as const } } }
      : {}),
  };
}

/** Ids among the given records that have a structural parent. */
async function containedIds(db: Queryable, ids: DbId[]): Promise<Set<DbId>> {
  const rows = await db.query.links.findMany({
    where: { sourceId: { in: ids }, predicate: 'contained_by' },
    columns: { sourceId: true },
  });
  return new Set(rows.map((r) => r.sourceId));
}

/**
 * Sample same-type pool opponents near an anchor score, widening the window
 * until enough candidates exist. When anchoring a provisional record, prefer
 * established opponents (high matchup count) so its score converges faster.
 */
async function selectOpponents(
  db: Queryable,
  opts: {
    type: RecordType;
    anchorElo: number;
    excludeIds: DbId[];
    needed: number;
    biasEstablished: boolean;
  }
): Promise<DbId[]> {
  let sample: { id: DbId }[] = [];
  for (const window of OPPONENT_WINDOWS) {
    sample = await db.query.records.findMany({
      columns: { id: true },
      where: {
        ...poolWhere(opts.type),
        ...(opts.excludeIds.length ? { id: { notIn: opts.excludeIds } } : {}),
        ...(window === Infinity
          ? {}
          : { eloScore: { gte: opts.anchorElo - window, lte: opts.anchorElo + window } }),
      },
      orderBy: () => sql`random()`,
      limit: Math.max(opts.needed * 8, 24),
    });
    if (sample.length >= opts.needed) break;
  }

  const ids = sample.map((r) => r.id);
  if (!opts.biasEstablished) return ids.slice(0, opts.needed);

  const counts = await matchupCounts(db, ids);
  // Stable sort keeps the random order within count ties
  return ids.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, opts.needed);
}

export const submitMatchup = publicProcedure
  .input(SubmitMatchupInputSchema)
  .mutation(async ({ ctx: { db }, input }) => {
    const [aId, bId] = 'winnerId' in input ? [input.winnerId, input.loserId] : input.drawIds;
    const winnerId = 'winnerId' in input ? input.winnerId : null;

    return db.transaction(async (tx) => {
      const pair = await tx.query.records.findMany({
        where: { id: { in: [aId, bId] } },
        columns: { id: true, type: true, eloScore: true },
      });
      const a = pair.find((r) => r.id === aId);
      const b = pair.find((r) => r.id === bId);
      if (!a || !b) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Submit matchup: record ${!a ? aId : bId} not found`,
        });
      }
      if (a.type !== b.type) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Submit matchup: cross-type matchup (${a.type} vs ${b.type}) is not allowed`,
        });
      }
      if (a.type === 'artifact') {
        const contained = await containedIds(tx, [aId, bId]);
        const childId = contained.has(aId) ? aId : contained.has(bId) ? bId : null;
        if (childId !== null) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Submit matchup: record ${childId} is contained by a parent record and cannot be ranked`,
          });
        }
      }

      const counts = await matchupCounts(tx, [aId, bId]);
      const countA = counts.get(aId) ?? 0;
      const countB = counts.get(bId) ?? 0;
      const { deltaA, deltaB } = eloDeltas(
        { eloScore: a.eloScore, matchupCount: countA },
        { eloScore: b.eloScore, matchupCount: countB },
        winnerId === null ? 'draw' : 'win'
      );

      await tx.insert(eloMatchups).values({
        recordAId: aId,
        recordBId: bId,
        winnerId,
        recordType: a.type,
      });

      const results = [
        { id: aId, eloScore: a.eloScore + deltaA, delta: deltaA, matchupCount: countA + 1 },
        { id: bId, eloScore: b.eloScore + deltaB, delta: deltaB, matchupCount: countB + 1 },
      ];
      for (const { id, eloScore } of results) {
        await tx.update(records).set({ eloScore }).where(eq(records.id, id));
      }
      return { results };
    });
  });

export const getOpponents = publicProcedure
  .input(GetOpponentsInputSchema)
  .query(async ({ ctx: { db }, input }) => {
    const focus = await db.query.records.findFirst({
      where: { id: input.recordId },
      columns: { id: true, type: true, eloScore: true, isCurated: true },
    });
    if (!focus) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Get opponents: record ${input.recordId} not found`,
      });
    }

    const counts = await matchupCounts(db, [focus.id]);
    const matchupCount = counts.get(focus.id) ?? 0;
    if (!focus.isCurated) return { matchupCount, opponentIds: [] };
    if (focus.type === 'artifact' && (await containedIds(db, [focus.id])).size > 0) {
      return { matchupCount, opponentIds: [] };
    }

    const opponentIds = await selectOpponents(db, {
      type: focus.type,
      anchorElo: focus.eloScore,
      excludeIds: [focus.id, ...input.excludeIds],
      needed: input.count,
      biasEstablished: matchupCount < PROVISIONAL_MATCHUPS,
    });
    return { matchupCount, opponentIds };
  });

export const getMatchup = publicProcedure
  .input(GetMatchupInputSchema)
  .query(async ({ ctx: { db }, input }): Promise<{ aId: DbId; bId: DbId } | null> => {
    const { recordType, focusRecordId, excludeIds } = input;

    if (focusRecordId) {
      const focus = await db.query.records.findFirst({
        where: { id: focusRecordId },
        columns: { id: true, type: true, eloScore: true, isCurated: true },
      });
      if (!focus) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Get matchup: record ${focusRecordId} not found`,
        });
      }
      if (!focus.isCurated) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Get matchup: only curated records can be ranked',
        });
      }
      if (focus.type === 'artifact' && (await containedIds(db, [focus.id])).size > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Get matchup: records contained by a parent cannot be ranked',
        });
      }

      // Focused burst: triangulate by aiming at a uniformly random point on
      // the pool's score spectrum instead of staying near the record's score.
      const [lowest, highest] = await Promise.all([
        db.query.records.findFirst({
          columns: { eloScore: true },
          where: poolWhere(focus.type),
          orderBy: (r, { asc }) => asc(r.eloScore),
        }),
        db.query.records.findFirst({
          columns: { eloScore: true },
          where: poolWhere(focus.type),
          orderBy: (r, { desc }) => desc(r.eloScore),
        }),
      ]);
      if (!lowest || !highest) return null;
      const target = lowest.eloScore + Math.random() * (highest.eloScore - lowest.eloScore);

      const nearest = await db.query.records.findMany({
        columns: { id: true },
        where: {
          ...poolWhere(focus.type),
          id: { notIn: [focus.id, ...excludeIds] },
        },
        orderBy: (r) => [sql`abs(${r.eloScore} - ${target})`, sql`random()`],
        limit: 5,
      });
      const opponent = nearest[Math.floor(Math.random() * nearest.length)];
      return opponent ? { aId: focus.id, bId: opponent.id } : null;
    }

    if (Math.random() < WILDCARD_PROBABILITY) {
      const pair = await db.query.records.findMany({
        columns: { id: true },
        where: {
          ...poolWhere(recordType),
          ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
        },
        orderBy: () => sql`random()`,
        limit: 2,
      });
      const [a, b] = pair;
      return a && b ? { aId: a.id, bId: b.id } : null;
    }

    // Surface under-ranked records first: the least-played of a random sample
    const sample = await db.query.records.findMany({
      columns: { id: true, eloScore: true },
      where: {
        ...poolWhere(recordType),
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: () => sql`random()`,
      limit: 50,
    });
    if (sample.length < 2) return null;
    const counts = await matchupCounts(
      db,
      sample.map((r) => r.id)
    );
    const [a] = sample.sort((x, y) => (counts.get(x.id) ?? 0) - (counts.get(y.id) ?? 0));
    if (!a) return null;

    const [bId] = await selectOpponents(db, {
      type: recordType,
      anchorElo: a.eloScore,
      excludeIds: [a.id, ...excludeIds],
      needed: 1,
      biasEstablished: false,
    });
    return bId ? { aId: a.id, bId } : null;
  });

export const eloRouter = createTRPCRouter({
  submitMatchup,
  getMatchup,
  getOpponents,
});
