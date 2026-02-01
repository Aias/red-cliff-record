#!/usr/bin/env bun
/**
 * Seed script for initial database data
 *
 * Loads core records into the database.
 * Predicates are now defined in code (packages/hozo/src/schema/predicates.ts).
 * Safe to run multiple times - uses upsert logic to avoid duplicates.
 *
 * Can be run directly: bun src/server/db/seed.ts
 * Or called from CLI: rcr db seed
 */

import type { RecordInsert } from '@hozo';
import { records } from '@hozo';
import { db } from '@/server/db/connections/postgres';
import { createIntegrationLogger } from '../integrations/common/logging';

export interface SeedResult {
  recordsSeeded: number;
}

const logger = createIntegrationLogger('db', 'seed');

const recordSeed = [
  {
    slug: 'nick-trombley',
    title: 'Nick Trombley',
    type: 'entity',
  },
  {
    slug: 'red-cliff-record',
    title: 'Red Cliff Record',
    type: 'artifact',
  },
] as const satisfies ReadonlyArray<RecordInsert>;

// Export types for use in other modules
export type RecordSlug = (typeof recordSeed)[number]['slug'];

/**
 * Seeds the database with core records.
 * Safe to run multiple times - uses upsert logic.
 * Returns counts of seeded items.
 */
export async function seedDatabase(): Promise<SeedResult> {
  // Seed records
  logger.info(`Inserting ${recordSeed.length} records...`);
  for (const record of recordSeed) {
    await db
      .insert(records)
      .values(record)
      .onConflictDoUpdate({
        target: records.slug,
        set: {
          title: record.title ?? null,
          type: record.type,
          recordUpdatedAt: new Date(),
        },
      });
  }

  logger.info(`Inserted/updated ${recordSeed.length} records`);

  return {
    recordsSeeded: recordSeed.length,
  };
}

async function main(): Promise<void> {
  try {
    logger.start('=== STARTING DATABASE SEED ===');
    const result = await seedDatabase();
    logger.complete('=== DATABASE SEED COMPLETED ===');
    logger.info(`Seeded ${result.recordsSeeded} records`);
    logger.info('-'.repeat(50));
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database', error);
    logger.error('=== DATABASE SEED FAILED ===');
    logger.info('-'.repeat(50));
    process.exit(1);
  }
}

// Only run when executed directly (not when imported)
if (import.meta.main) {
  void main();
}
