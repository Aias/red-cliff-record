#!/usr/bin/env bun
/**
 * ELO Seed Script
 *
 * Computes initial ELO scores for all records based on richness
 * signals: rating, link topology, media, content completeness.
 *
 * Scores are computed per record type (entity/concept/artifact)
 * using percentile-based mapping to the ELO range [900–1700].
 *
 * Idempotent — safe to run multiple times. Overwrites eloScore
 * for all records (since no matchup history exists yet).
 *
 * Usage:
 *   NODE_ENV=development bun src/server/db/seed-elo.ts
 *   NODE_ENV=development bun src/server/db/seed-elo.ts --dry-run
 */

import { records } from '@hozo';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { createIntegrationLogger } from '../integrations/common/logging';

const logger = createIntegrationLogger('db', 'seed-elo');

const ELO_MIN = 900;
const ELO_MAX = 1700;

// ── Data fetching ──────────────────────────────────────────────

interface RecordSignals {
  id: number;
  title: string | null;
  type: string;
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
 * Uses lateral subqueries for link/media counts to avoid N+1.
 */
async function fetchRecordSignals(): Promise<RecordSignals[]> {
  const rows = await db.execute<{
    id: number;
    title: string | null;
    type: string;
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
      -- Containment links (both directions): structural hierarchy
      COALESCE(cl.cnt, 0) AS containment_links,
      -- All other links (both directions), excluding format (noise, not signal)
      COALESCE(ol.cnt, 0) AS other_links,
      -- Media attachments
      COALESCE(m.cnt, 0) AS media_count
    FROM records r
    LEFT JOIN (
      SELECT rid, COUNT(*) AS cnt FROM (
        SELECT source_id AS rid FROM links WHERE predicate IN ('contained_by', 'quotes')
        UNION ALL
        SELECT target_id AS rid FROM links WHERE predicate IN ('contained_by', 'quotes')
      ) t GROUP BY rid
    ) cl ON cl.rid = r.id
    LEFT JOIN (
      SELECT rid, COUNT(*) AS cnt FROM (
        SELECT source_id AS rid FROM links WHERE predicate NOT IN ('contained_by', 'quotes', 'has_format')
        UNION ALL
        SELECT target_id AS rid FROM links WHERE predicate NOT IN ('contained_by', 'quotes', 'has_format')
      ) t GROUP BY rid
    ) ol ON ol.rid = r.id
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
 *
 * All link counts are bidirectional — direction is an artifact
 * of entry order, not importance.
 */
function computeRelevance(s: RecordSignals): number {
  const multiplier = s.rating + 1 + (s.isCurated ? 1 : 0);

  const richness =
    s.rating +
    s.containmentLinks + // structural hierarchy (parent/child, quotes)
    s.otherLinks * 2 + // graph centrality (refs, tags, associations, creation)
    s.mediaCount * 2 + // visual richness
    (s.hasMediaCaption ? 4 : 0) + // curated media description
    (s.hasNotes ? 2 : 0) + // personal annotation
    (s.hasUrl ? 1 : 0) + // has source
    (s.hasSummary ? 3 : 0) + // has summary
    (s.hasContent ? 4 : 0); // has substantial content

  return multiplier * Math.sqrt(Math.max(richness, 0));
}

// ── ELO mapping ────────────────────────────────────────────────

interface ScoredRecord {
  id: number;
  type: string;
  relevance: number;
  elo: number;
}

/**
 * Map relevance scores to ELO using percentile ranking within each type.
 * Ties share the same percentile (average rank method).
 */
function mapToElo(signalsList: RecordSignals[]): ScoredRecord[] {
  const scored = signalsList.map((s) => ({
    id: s.id,
    type: s.type,
    relevance: computeRelevance(s),
    elo: 0,
  }));

  // Group by type and assign ELO via percentile
  const byType = Map.groupBy(scored, (r) => r.type);

  for (const [type, group] of byType) {
    if (!group || group.length === 0) continue;

    if (group.length === 1) {
      group[0]!.elo = Math.round((ELO_MIN + ELO_MAX) / 2);
      continue;
    }

    // Sort by relevance ascending
    group.sort((a, b) => a.relevance - b.relevance);

    // Assign percentile rank (0 to 1)
    for (let i = 0; i < group.length; i++) {
      const percentile = i / (group.length - 1);
      group[i]!.elo = Math.round(ELO_MIN + percentile * (ELO_MAX - ELO_MIN));
    }

    const first = group[0]!;
    const last = group[group.length - 1]!;
    logger.info(
      `${type}: ${group.length} records, relevance range [${first.relevance.toFixed(1)}–${last.relevance.toFixed(1)}]`
    );
  }

  return scored;
}

// ── Summary reporting ──────────────────────────────────────────

function printSummary(scored: ScoredRecord[], signals: RecordSignals[]) {
  const byType = Map.groupBy(scored, (r) => r.type);
  const signalsById = new Map(signals.map((s) => [s.id, s]));

  for (const [type, group] of byType) {
    if (!group) continue;

    const sorted = [...group].sort((a, b) => b.elo - a.elo);

    // Distribution buckets
    const buckets = new Map<string, number>();
    for (const r of sorted) {
      const bucket = `${Math.floor(r.elo / 100) * 100}–${Math.floor(r.elo / 100) * 100 + 99}`;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    logger.info(`\n── ${type} (${sorted.length} records) ──`);
    logger.info('Distribution:');
    for (const [bucket, count] of [...buckets].sort(([a], [b]) => a.localeCompare(b))) {
      logger.info(
        `  ${bucket}: ${'█'.repeat(Math.ceil(count / Math.max(sorted.length / 40, 1)))} (${count})`
      );
    }

    // Top 15
    logger.info('Top 15:');
    for (const r of sorted.slice(0, 15)) {
      const s = signalsById.get(r.id);
      const title = s?.title ?? '(untitled)';
      const links = s ? s.containmentLinks + s.otherLinks : 0;
      const flags = [s?.rating ? `★${s.rating}` : '', s?.isCurated ? 'curated' : '']
        .filter(Boolean)
        .join(' ');
      logger.info(
        `  ${r.elo}  ${r.relevance.toFixed(1).padStart(6)}  ${String(links).padStart(4)} links  ${title}  ${flags}`
      );
    }

    // Bottom 10
    logger.info('Bottom 10:');
    for (const r of sorted.slice(-10)) {
      const s = signalsById.get(r.id);
      const title = s?.title ?? '(untitled)';
      const links = s ? s.containmentLinks + s.otherLinks : 0;
      logger.info(
        `  ${r.elo}  ${r.relevance.toFixed(1).padStart(6)}  ${String(links).padStart(4)} links  ${title}`
      );
    }
  }
}

// ── Main ───────────────────────────────────────────────────────

async function seedElo(dryRun: boolean): Promise<{ updated: number }> {
  logger.info('Fetching record signals...');
  const signals = await fetchRecordSignals();
  logger.info(`Found ${signals.length} records`);

  const scored = mapToElo(signals);
  printSummary(scored, signals);

  if (dryRun) {
    logger.info('\n🏁 Dry run — no changes written.');
    return { updated: 0 };
  }

  // Batch update ELO scores
  logger.info('\nWriting ELO scores...');
  let updated = 0;
  for (const r of scored) {
    await db.update(records).set({ eloScore: r.elo }).where(eq(records.id, r.id));
    updated++;
  }
  logger.info(`Updated ${updated} records`);

  return { updated };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  try {
    logger.start(`=== ELO SEED ${dryRun ? '(DRY RUN) ' : ''}===`);
    const result = await seedElo(dryRun);
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
