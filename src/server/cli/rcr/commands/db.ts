/**
 * Database commands for the CLI
 *
 * Provides unified interface for database operations:
 * - backup/restore: Shell wrapper around db-manager.sh
 * - reset: Shell wrapper, local only
 * - seed: Direct TypeScript call to seedDatabase()
 * - status: Pure TypeScript, queries database for counts
 */

import { realpathSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { links, predicates, records } from '@aias/hozo';
import { spawn } from 'bun';
import { count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/connections';
import { seedDatabase } from '@/server/db/seed';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const LocationSchema = z.enum(['local', 'remote']);

// Resolve project root from this file's location (src/server/cli/rcr/commands/db.ts -> project root)
const scriptPath = fileURLToPath(import.meta.url);
const realScriptPath = realpathSync(scriptPath);
const projectRoot = resolve(dirname(realScriptPath), '../../../../..');
const dbManagerPath = resolve(projectRoot, 'src/server/db/db-manager.sh');

const BackupOptionsSchema = BaseOptionsSchema.extend({
	'data-only': z.boolean().optional(),
	'dry-run': z.boolean().optional(),
	n: z.boolean().optional(),
}).strict();

const RestoreOptionsSchema = BaseOptionsSchema.extend({
	clean: z.boolean().optional(),
	'data-only': z.boolean().optional(),
	'dry-run': z.boolean().optional(),
	n: z.boolean().optional(),
}).strict();

/**
 * Run db-manager.sh with given arguments, streaming output to console
 */
async function runDbManager(args: string[]): Promise<void> {
	const proc = spawn({
		cmd: ['bash', dbManagerPath, ...args],
		cwd: projectRoot,
		stdout: 'inherit',
		stderr: 'inherit',
	});

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		throw createError('DATABASE_ERROR', `db-manager.sh exited with code ${exitCode}`);
	}
}

/**
 * Backup database
 * Usage: rcr db backup <local|remote> [--data-only] [--dry-run]
 */
export const backup: CommandHandler = async (args, options) => {
	const parsedOptions = parseOptions(BackupOptionsSchema, options);
	const locationArg = args[0];

	if (!locationArg) {
		throw createError('VALIDATION_ERROR', 'Location required: local or remote');
	}

	const locationResult = LocationSchema.safeParse(locationArg);
	if (!locationResult.success) {
		throw createError(
			'VALIDATION_ERROR',
			`Invalid location: ${locationArg}. Must be 'local' or 'remote'`
		);
	}

	const location = locationResult.data;
	const shellArgs: string[] = [];
	const dryRun = parsedOptions['dry-run'] ?? parsedOptions.n ?? false;

	if (parsedOptions['data-only']) {
		shellArgs.push('--data-only');
	}

	if (dryRun) {
		shellArgs.push('--dry-run');
	}

	shellArgs.push('backup', location);

	await runDbManager(shellArgs);

	return success({
		action: 'backup',
		location,
		dataOnly: parsedOptions['data-only'] ?? false,
		dryRun,
	});
};

/**
 * Restore database
 * Usage: rcr db restore <local|remote> [--clean] [--data-only] [--dry-run]
 */
export const restore: CommandHandler = async (args, options) => {
	const parsedOptions = parseOptions(RestoreOptionsSchema, options);
	const locationArg = args[0];

	if (!locationArg) {
		throw createError('VALIDATION_ERROR', 'Location required: local or remote');
	}

	const locationResult = LocationSchema.safeParse(locationArg);
	if (!locationResult.success) {
		throw createError(
			'VALIDATION_ERROR',
			`Invalid location: ${locationArg}. Must be 'local' or 'remote'`
		);
	}

	const location = locationResult.data;
	const shellArgs: string[] = [];
	const dryRun = parsedOptions['dry-run'] ?? parsedOptions.n ?? false;

	if (parsedOptions.clean) {
		shellArgs.push('--clean');
	}

	if (parsedOptions['data-only']) {
		shellArgs.push('--data-only');
	}

	if (dryRun) {
		shellArgs.push('--dry-run');
	}

	shellArgs.push('restore', location);

	await runDbManager(shellArgs);

	return success({
		action: 'restore',
		location,
		clean: parsedOptions.clean ?? false,
		dataOnly: parsedOptions['data-only'] ?? false,
		dryRun,
	});
};

/**
 * Reset database (local only)
 * Usage: rcr db reset
 */
export const reset: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	// Reset is always local-only
	const locationArg = args[0];
	if (locationArg && locationArg !== 'local') {
		throw createError('PERMISSION_DENIED', 'Reset is only supported for local database');
	}

	await runDbManager(['reset', 'local']);

	return success({
		action: 'reset',
		location: 'local',
	});
};

/**
 * Seed database with initial data (local only)
 * Usage: rcr db seed
 */
export const seed: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	// Seed is always local-only
	const locationArg = args[0];
	if (locationArg && locationArg !== 'local') {
		throw createError('PERMISSION_DENIED', 'Seed is only supported for local database');
	}

	const result = await seedDatabase();

	return success({
		action: 'seed',
		location: 'local',
		predicatesSeeded: result.predicatesSeeded,
		recordsSeeded: result.recordsSeeded,
	});
};

/**
 * Show database status and record counts
 * Usage: rcr db status [local|remote]
 */
export const status: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	const locationArg = args[0] ?? 'local';
	const locationResult = LocationSchema.safeParse(locationArg);
	if (!locationResult.success) {
		throw createError(
			'VALIDATION_ERROR',
			`Invalid location: ${locationArg}. Must be 'local' or 'remote'`
		);
	}

	const location = locationResult.data;

	// Note: Currently we only support the default connection (DATABASE_URL)
	// In the future, we could support switching connections based on location
	if (location === 'remote') {
		throw createError(
			'VALIDATION_ERROR',
			'Remote status check not yet implemented. The CLI currently uses DATABASE_URL which should point to your desired database.'
		);
	}

	// Query counts from database in parallel (sequential queries hang in CLI context)
	const [[recordCount], [linkCount], [predicateCount]] = await Promise.all([
		db.select({ count: count() }).from(records),
		db.select({ count: count() }).from(links),
		db.select({ count: count() }).from(predicates),
	]);

	return success({
		location,
		connected: true,
		counts: {
			records: recordCount?.count ?? 0,
			links: linkCount?.count ?? 0,
			predicates: predicateCount?.count ?? 0,
		},
	});
};
