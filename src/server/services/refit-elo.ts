import { records } from '@hozo';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { fitBradleyTerry } from '@/shared/lib/elo';

export type RefitEloResult = { matchups: number; ranked: number; updated: number };

/**
 * Refit every ELO score from the stored matchup history with a batch
 * Bradley-Terry fit, so each recorded result informs the whole comparison
 * graph instead of just its two participants. Records without matchups keep
 * their current score. Incremental arena updates remain the live layer;
 * this recomputes from the same evidence whenever it runs.
 */
export async function runEloRefit(): Promise<RefitEloResult> {
  const matchups = await db.query.eloMatchups.findMany({
    columns: { recordAId: true, recordBId: true, winnerId: true },
  });
  const fitted = fitBradleyTerry(matchups);
  if (fitted.size === 0) {
    return { matchups: 0, ranked: 0, updated: 0 };
  }
  const current = await db.query.records.findMany({
    where: { id: { in: [...fitted.keys()] } },
    columns: { id: true, eloScore: true },
  });
  const changed = current.flatMap((record) => {
    const eloScore = fitted.get(record.id);
    return eloScore !== undefined && eloScore !== record.eloScore
      ? [{ id: record.id, eloScore }]
      : [];
  });
  if (changed.length > 0) {
    const values = sql.join(
      changed.map(({ id, eloScore }) => sql`(${id}::int, ${eloScore}::int)`),
      sql`, `
    );
    await db.execute(sql`
      update ${records}
      set elo_score = fitted.elo_score
      from (values ${values}) as fitted(id, elo_score)
      where ${records.id} = fitted.id
    `);
  }
  return { matchups: matchups.length, ranked: fitted.size, updated: changed.length };
}
