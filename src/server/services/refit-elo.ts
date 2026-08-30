import { records, type RecordType } from '@hozo';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { fitBradleyTerry, relevanceToEloPriors } from '@/shared/lib/elo';

export type RefitEloResult = { matchups: number; ranked: number; updated: number };

/** Rows per bulk-update statement, keeping parameter counts well under the wire-protocol cap. */
const UPDATE_BATCH_SIZE = 5000;

type RecordSignals = {
  id: number;
  type: RecordType;
  is_curated: boolean;
  has_notes: boolean;
  has_url: boolean;
  has_summary: boolean;
  has_content: boolean;
  has_media_caption: boolean;
  containment_links: string;
  other_links: string;
  media_count: string;
};

/**
 * Compute a raw relevance score from richness signals: explicit curation as a
 * multiplier over a sqrt-dampened sum that rewards breadth of metadata
 * without letting any single signal dominate.
 */
function computeRelevance(s: RecordSignals): number {
  const multiplier = 1 + (s.is_curated ? 1 : 0);
  const richness =
    Number(s.containment_links) + // structural hierarchy (parent/child, quotes)
    Number(s.other_links) * 2 + // graph centrality (refs, tags, associations, creation)
    Number(s.media_count) * 2 + // visual richness
    (s.has_media_caption ? 4 : 0) + // curated media description
    (s.has_notes ? 2 : 0) + // personal annotation
    (s.has_url ? 1 : 0) + // has source
    (s.has_summary ? 3 : 0) + // has summary
    (s.has_content ? 4 : 0); // has substantial content
  return multiplier * Math.sqrt(richness);
}

/**
 * Derive a prior score for every record from its current richness signals,
 * percentile-mapped onto the Elo scale within each record type so types with
 * different richness profiles stay comparable.
 */
async function computePriors(): Promise<Map<number, number>> {
  const rows = await db.execute<RecordSignals>(sql`
    SELECT
      r.id,
      r.type,
      r.curated_at IS NOT NULL AS is_curated,
      r.notes IS NOT NULL AND r.notes != '' AS has_notes,
      r.url IS NOT NULL AND r.url != '' AS has_url,
      r.summary IS NOT NULL AND r.summary != '' AS has_summary,
      r.content IS NOT NULL AND r.content != '' AS has_content,
      r.media_caption IS NOT NULL AND r.media_caption != '' AS has_media_caption,
      COALESCE(l.containment_cnt, 0) AS containment_links,
      COALESCE(l.other_cnt, 0) AS other_links,
      COALESCE(m.cnt, 0) AS media_count
    FROM records r
    LEFT JOIN (
      SELECT
        rid,
        COUNT(*) FILTER (WHERE predicate IN ('contained_by', 'quotes')) AS containment_cnt,
        COUNT(*) FILTER (WHERE predicate NOT IN ('contained_by', 'quotes', 'has_format')) AS other_cnt
      FROM (
        SELECT source_id AS rid, predicate FROM links
        UNION ALL
        SELECT target_id AS rid, predicate FROM links
      ) t
      GROUP BY rid
    ) l ON l.rid = r.id
    LEFT JOIN (
      SELECT record_id AS rid, COUNT(*) AS cnt
      FROM media WHERE record_id IS NOT NULL
      GROUP BY record_id
    ) m ON m.rid = r.id
  `);
  const byType = Map.groupBy(rows, (row) => row.type);
  const priors = new Map<number, number>();
  for (const group of byType.values()) {
    const relevances = new Map(group.map((row) => [row.id, computeRelevance(row)]));
    for (const [id, elo] of relevanceToEloPriors(relevances)) priors.set(id, elo);
  }
  return priors;
}

/**
 * Refit every ELO score with a batch Bradley-Terry fit: each record gets a
 * richness-derived prior, and the stored matchup history moves records
 * relative to those priors, propagating each result through the whole
 * comparison graph instead of just its two participants. Records with no
 * matchups score exactly their prior. Incremental arena updates remain the
 * live layer; this recomputes from the same evidence whenever it runs.
 */
export async function runEloRefit(): Promise<RefitEloResult> {
  const [matchups, priors] = await Promise.all([
    db.query.eloMatchups.findMany({
      columns: { recordAId: true, recordBId: true, winnerId: true },
    }),
    computePriors(),
  ]);
  const fitted = fitBradleyTerry(matchups, priors);
  if (fitted.size === 0) {
    return { matchups: 0, ranked: 0, updated: 0 };
  }
  const current = await db.query.records.findMany({ columns: { id: true, eloScore: true } });
  const changed = current.flatMap((record) => {
    const eloScore = fitted.get(record.id);
    return eloScore !== undefined && eloScore !== record.eloScore
      ? [{ id: record.id, eloScore }]
      : [];
  });
  for (let offset = 0; offset < changed.length; offset += UPDATE_BATCH_SIZE) {
    const values = sql.join(
      changed
        .slice(offset, offset + UPDATE_BATCH_SIZE)
        .map(({ id, eloScore }) => sql`(${id}::int, ${eloScore}::int)`),
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
