#!/usr/bin/env bun
/**
 * ELO Seed Script
 *
 * Computes initial ELO scores for all records based on richness
 * signals: rating, link topology, media, content completeness.
 *
 * Scores are computed per record type (entity/concept/artifact):
 * each record's within-type percentile is mapped through an inverse
 * normal CDF centered on the 1200 default (sd 150), so seeds follow
 * the bell-shaped distribution matchup play converges to and new
 * records enter at the median.
 *
 * Refuses to run once matchup history exists — ELO is user-sovereign
 * after ranking begins. Pass --force to overwrite anyway.
 *
 * Usage:
 *   NODE_ENV=development bun src/server/db/seed-elo.ts
 *   NODE_ENV=development bun src/server/db/seed-elo.ts --dry-run
 */

import { eloMatchups, type RecordType } from '@hozo';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { createIntegrationLogger } from '../integrations/common/logging';

const logger = createIntegrationLogger('db', 'seed-elo');

const ELO_MEAN = 1200;
const ELO_SD = 150;

// ── Data fetching ──────────────────────────────────────────────

interface RecordSignals {
  id: number;
  title: string | null;
  type: RecordType;
  rating: number;
  isCurated: boolean;
  hasNotes: boolean;
  hasUrl: boolean;
  hasSummary: boolean;
  hasContent: boolean;
  hasMediaCaption: boolean;
  containmentLinks: number;
  otherLinks: number;
  mediaCount: number;
}

/**
 * Fetch all records with their richness signals in a single query.
 * Link counts for both directions come from a single pass over links —
 * direction is an artifact of entry order, not importance.
 */
async function fetchRecordSignals(): Promise<RecordSignals[]> {
  const rows = await db.execute<{
    id: number;
    title: string | null;
    type: RecordType;
    rating: number;
    is_curated: boolean;
    has_notes: boolean;
    has_url: boolean;
    has_summary: boolean;
    has_content: boolean;
    has_media_caption: boolean;
    containment_links: string;
    other_links: string;
    media_count: string;
  }>(sql`
    SELECT
      r.id,
      r.title,
      r.type,
      r.rating,
      r.is_curated,
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
        -- Containment links: structural hierarchy
        COUNT(*) FILTER (WHERE predicate IN ('contained_by', 'quotes')) AS containment_cnt,
        -- All other links, excluding format (noise, not signal)
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
    ORDER BY r.id
  `);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    rating: r.rating,
    isCurated: r.is_curated,
    hasNotes: r.has_notes,
    hasUrl: r.has_url,
    hasSummary: r.has_summary,
    hasContent: r.has_content,
    hasMediaCaption: r.has_media_caption,
    containmentLinks: Number(r.containment_links),
    otherLinks: Number(r.other_links),
    mediaCount: Number(r.media_count),
  }));
}

// ── Relevance scoring ──────────────────────────────────────────

/**
 * Compute a raw relevance score from richness signals.
 *
 * Structure: (explicit_quality) * sqrt(richness_sum)
 *
 * The multiplier (rating + boosts) ensures explicit curation
 * carries the most weight. The sqrt-dampened sum rewards breadth
 * of metadata without letting any single signal dominate.
 */
function computeRelevance(s: RecordSignals): number {
  const multiplier = s.rating + 1 + (s.isCurated ? 1 : 0);

  const richness =
    s.rating + // also in the multiplier — keeps rated-but-otherwise-empty records off the floor
    s.containmentLinks + // structural hierarchy (parent/child, quotes)
    s.otherLinks * 2 + // graph centrality (refs, tags, associations, creation)
    s.mediaCount * 2 + // visual richness
    (s.hasMediaCaption ? 4 : 0) + // curated media description
    (s.hasNotes ? 2 : 0) + // personal annotation
    (s.hasUrl ? 1 : 0) + // has source
    (s.hasSummary ? 3 : 0) + // has summary
    (s.hasContent ? 4 : 0); // has substantial content

  // Ratings can be -1 in legacy rows (below the insert schema's 0 floor),
  // which zeroes the multiplier and can drive richness negative.
  return multiplier * Math.sqrt(Math.max(richness, 0));
}

// ── ELO mapping ────────────────────────────────────────────────

interface ScoredRecord {
  signal: RecordSignals;
  relevance: number;
  elo: number;
}

/**
 * Inverse standard normal CDF (Acklam's rational approximation,
 * |ε| < 1.2e-9). Defined on the open interval (0, 1).
 */
function probit(p: number): number {
  const pLow = 0.02425;
  if (p < pLow || p > 1 - pLow) {
    const c1 = -7.784894002430293e-3;
    const c2 = -3.223964580411365e-1;
    const c3 = -2.400758277161838;
    const c4 = -2.549732539343734;
    const c5 = 4.374664141464968;
    const c6 = 2.938163982698783;
    const d1 = 7.784695709041462e-3;
    const d2 = 3.224671290700398e-1;
    const d3 = 2.445134137142996;
    const d4 = 3.754408661907416;
    const q = Math.sqrt(-2 * Math.log(Math.min(p, 1 - p)));
    const z =
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    return p < pLow ? z : -z;
  }
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;
  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

/**
 * Map relevance scores to ELO within each type: percentile rank
 * through the inverse normal CDF, centered on the 1200 default.
 * Ties share the same percentile (average rank method).
 */
function mapToElo(signalsList: RecordSignals[]): ScoredRecord[] {
  const scored: ScoredRecord[] = signalsList.map((signal) => ({
    signal,
    relevance: computeRelevance(signal),
    elo: 0,
  }));

  const byType = Map.groupBy(scored, (r) => r.signal.type);

  for (const [type, group] of byType) {
    const tiers = [...Map.groupBy(group, (r) => r.relevance)].sort(([a], [b]) => a - b);

    let rank = 0;
    for (const [, tied] of tiers) {
      const midRank = rank + (tied.length - 1) / 2;
      const percentile = (midRank + 0.5) / group.length;
      const elo = Math.round(ELO_MEAN + ELO_SD * probit(percentile));
      for (const r of tied) r.elo = elo;
      rank += tied.length;
    }

    const relevances = tiers.map(([relevance]) => relevance);
    logger.info(
      `${type}: ${group.length} records, ${tiers.length} distinct relevance values in [${Math.min(...relevances).toFixed(1)}–${Math.max(...relevances).toFixed(1)}]`
    );
  }

  return scored;
}

// ── Summary reporting ──────────────────────────────────────────

function printSummary(scored: ScoredRecord[]) {
  const byType = Map.groupBy(scored, (r) => r.signal.type);

  for (const [type, group] of byType) {
    const sorted = [...group].sort((a, b) => b.elo - a.elo);

    // Distribution buckets
    const buckets = new Map<number, number>();
    for (const r of sorted) {
      const floor = Math.floor(r.elo / 100) * 100;
      buckets.set(floor, (buckets.get(floor) ?? 0) + 1);
    }

    logger.info(`\n── ${type} (${sorted.length} records) ──`);
    logger.info('Distribution:');
    for (const [floor, count] of [...buckets].sort(([a], [b]) => a - b)) {
      logger.info(
        `  ${floor}–${floor + 99}: ${'█'.repeat(Math.ceil(count / Math.max(sorted.length / 40, 1)))} (${count})`
      );
    }

    logger.info('Top 15:');
    for (const r of sorted.slice(0, 15)) {
      const s = r.signal;
      const links = s.containmentLinks + s.otherLinks;
      const flags = [s.rating ? `★${s.rating}` : '', s.isCurated ? 'curated' : '']
        .filter(Boolean)
        .join(' ');
      logger.info(
        `  ${r.elo}  ${r.relevance.toFixed(1).padStart(6)}  ${String(links).padStart(4)} links  ${s.title ?? '(untitled)'}  ${flags}`
      );
    }

    logger.info('Bottom 10:');
    for (const r of sorted.slice(-10)) {
      const s = r.signal;
      const links = s.containmentLinks + s.otherLinks;
      logger.info(
        `  ${r.elo}  ${r.relevance.toFixed(1).padStart(6)}  ${String(links).padStart(4)} links  ${s.title ?? '(untitled)'}`
      );
    }
  }
}

// ── Main ───────────────────────────────────────────────────────

async function seedElo(dryRun: boolean, force: boolean): Promise<{ updated: number }> {
  const matchupCount = await db.$count(eloMatchups);
  if (matchupCount > 0) {
    if (!force) {
      throw new Error(
        `${matchupCount} matchups exist — ELO is user-sovereign once ranking begins. Pass --force to overwrite anyway.`
      );
    }
    logger.warn(`Overwriting scores despite ${matchupCount} existing matchups (--force)`);
  }

  logger.info('Fetching record signals...');
  const signals = await fetchRecordSignals();
  logger.info(`Found ${signals.length} records`);

  const scored = mapToElo(signals);
  printSummary(scored);

  if (dryRun) {
    logger.info('\n🏁 Dry run — no changes written.');
    return { updated: 0 };
  }

  logger.info('\nWriting ELO scores...');
  // Array literals as single params — drizzle expands JS arrays into one
  // placeholder per element, which overflows Postgres's parameter limit.
  const ids = `{${scored.map((r) => r.signal.id).join(',')}}`;
  const elos = `{${scored.map((r) => r.elo).join(',')}}`;
  const updatedRows = await db.execute<{ id: number }>(sql`
    UPDATE records r
    SET elo_score = v.elo
    FROM unnest(${ids}::int[], ${elos}::int[]) AS v(id, elo)
    WHERE r.id = v.id AND r.elo_score IS DISTINCT FROM v.elo
    RETURNING r.id
  `);
  logger.info(
    `Updated ${updatedRows.length} records (${scored.length - updatedRows.length} unchanged)`
  );

  return { updated: updatedRows.length };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  try {
    logger.start(`=== ELO SEED ${dryRun ? '(DRY RUN) ' : ''}===`);
    const result = await seedElo(dryRun, force);
    logger.complete(`=== ELO SEED COMPLETED (${result.updated} updated) ===`);
    process.exit(0);
  } catch (error) {
    logger.error('ELO seed failed', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  void main();
}
