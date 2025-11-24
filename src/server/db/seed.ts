#!/usr/bin/env bun
/**
 * Seed script for initial database data
 *
 * Loads canonical predicate vocabulary and core records into the database.
 * Safe to run multiple times - uses upsert logic to avoid duplicates.
 */

import type { PredicateInsert, RecordInsert } from '@aias/hozo';
import { predicates, records } from '@aias/hozo';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '../integrations/common/logging';

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

/**
 * Canonical predicate vocabulary
 * ──────────────────────────────
 * • Only rows with `canonical: true` are stored in `links`.
 * • `inverseSlug` supplies a readable label when traversing the edge
 *   in the opposite direction.
 * • Active-present verb style: has_creator, contained_by, format_of …
 */

const predicateSeed = [
	/* ────────────  Creation  ──────────── */
	{
		slug: 'created_by', // work → person
		name: 'created by',
		type: 'creation',
		role: 'creator',
		inverseSlug: 'creator_of',
		canonical: true,
	},
	{
		slug: 'creator_of', // person ← work
		name: 'creator of',
		type: 'creation',
		role: 'creator',
		inverseSlug: 'created_by',
		canonical: false,
	},
	{
		slug: 'via', // work → referrer
		name: 'via',
		type: 'creation',
		role: 'referrer',
		inverseSlug: 'source_for',
		canonical: true,
	},
	{
		slug: 'source_for', // referrer ← work
		name: 'source for',
		type: 'creation',
		role: 'referrer',
		inverseSlug: 'via',
		canonical: false,
	},
	{
		slug: 'edited_by',
		name: 'edited by',
		type: 'creation',
		role: 'editor',
		inverseSlug: 'editor_of',
		canonical: true,
	},
	{
		slug: 'editor_of',
		name: 'editor of',
		type: 'creation',
		role: 'editor',
		inverseSlug: 'edited_by',
		canonical: false,
	},

	{
		slug: 'translated_by',
		name: 'translated by',
		type: 'creation',
		role: 'translator',
		inverseSlug: 'translator_of',
		canonical: true,
	},
	{
		slug: 'translator_of',
		name: 'translator of',
		type: 'creation',
		role: 'translator',
		inverseSlug: 'translated_by',
		canonical: false,
	},
	/* ─────── Containment (child → parent) ─────── */
	{
		slug: 'contained_by',
		name: 'contained by',
		type: 'containment',
		inverseSlug: 'contains',
		canonical: true,
	},
	{
		slug: 'contains',
		name: 'contains',
		type: 'containment',
		inverseSlug: 'contained_by',
		canonical: false,
	},
	{
		slug: 'quotes',
		name: 'quotes',
		type: 'containment',
		inverseSlug: 'quoted_in',
		canonical: true,
	},
	{
		slug: 'quoted_in',
		name: 'quoted in',
		type: 'containment',
		inverseSlug: 'quotes',
		canonical: false,
	},

	/* ───────────  Form  ─────────── */
	{
		slug: 'has_format',
		name: 'has format',
		type: 'form',
		inverseSlug: 'format_of',
		canonical: true,
	},
	{
		slug: 'format_of',
		name: 'format of',
		type: 'form',
		inverseSlug: 'has_format',
		canonical: false,
	},

	/* ───────────  Description  ─────────── */
	{
		slug: 'tagged_with',
		name: 'tagged with',
		type: 'description',
		inverseSlug: 'tag_of',
		canonical: true,
	},
	{
		slug: 'tag_of',
		name: 'tag of',
		type: 'description',
		inverseSlug: 'tagged_with',
		canonical: false,
	},

	/* ───────────  Reference  ─────────── */
	{
		slug: 'references',
		name: 'references',
		type: 'reference',
		inverseSlug: 'referenced_by',
		canonical: true,
	},
	{
		slug: 'referenced_by',
		name: 'referenced by',
		type: 'reference',
		inverseSlug: 'references',
		canonical: false,
	},
	{
		slug: 'about',
		name: 'about',
		type: 'reference',
		inverseSlug: 'subject_of',
		canonical: true,
	},
	{
		slug: 'subject_of',
		name: 'subject of',
		type: 'reference',
		inverseSlug: 'about',
		canonical: false,
	},

	/* ───────────  Association  ─────────── */
	{
		slug: 'related_to',
		name: 'related to',
		type: 'association',
		inverseSlug: 'related_to', // self-inverse
		canonical: true,
	},

	/* ───────────  Identity  ─────────── */
	{
		slug: 'same_as',
		name: 'same as',
		type: 'identity',
		inverseSlug: 'same_as',
		canonical: true, // self-inverse
	},
] as const satisfies ReadonlyArray<PredicateInsert>;

// Export types for use in other modules
export type RecordSlug = (typeof recordSeed)[number]['slug'];
export type PredicateSlug = (typeof predicateSeed)[number]['slug'];

async function seedDatabase(): Promise<void> {
	// Seed predicates
	logger.info(`Inserting ${predicateSeed.length} predicates...`);
	for (const predicate of predicateSeed) {
		await db
			.insert(predicates)
			.values(predicate)
			.onConflictDoUpdate({
				target: predicates.slug,
				set: {
					name: predicate.name,
					type: predicate.type,
					role: 'role' in predicate ? (predicate.role ?? null) : null,
					inverseSlug: predicate.inverseSlug ?? null,
					canonical: predicate.canonical,
					recordUpdatedAt: new Date(),
				},
			});
	}

	logger.info(`Inserted/updated ${predicateSeed.length} predicates`);

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
}

async function main(): Promise<void> {
	try {
		logger.start('=== STARTING DATABASE SEED ===');
		await seedDatabase();
		logger.complete('=== DATABASE SEED COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error seeding database', error);
		logger.error('=== DATABASE SEED FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the seed
main();
