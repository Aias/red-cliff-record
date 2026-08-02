import { eloMatchups } from '@hozo';
import { count, inArray } from 'drizzle-orm';
import type { Db } from '@/server/db/connections/postgres';
import type { DbId } from '@/shared/types/api';

type Queryable = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

/** Total matchups played per record, counting appearances on either side. */
export async function matchupCounts(db: Queryable, ids: DbId[]): Promise<Map<DbId, number>> {
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
 * Creation-time ELO seed from an external 0-3 star signal. No signal enters at
 * the 1200 default — absence of signal is not a negative signal.
 */
export function starsToElo(stars: number): number {
  return 1200 + Math.min(Math.max(stars, 0), 3) * 100;
}
