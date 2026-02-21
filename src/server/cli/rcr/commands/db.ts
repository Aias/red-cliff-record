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
import { links, PREDICATES, records } from '@hozo';
import { spawn } from 'bun';
import { count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db/connections/postgres';
import { seedDatabase } from '@/server/db/seed';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const LocationSchema = z.enum(['prod', 'dev']);

// Resolve project root from this file's location (src/server/cli/rcr/commands/db.ts -> project root)
const scriptPath = fileURLToPath(import.meta.url);
const realScriptPath = realpathSync(scriptPath);
const projectRoot = resolve(dirname(realScriptPath), '../../../../..');
const dbManagerPath = resolve(projectRoot, 'src/server/db/db-manager.sh');

const BackupOptionsSchema = BaseOptionsSchema.extend({
  'data-only': z.boolean().optional(),
  'dry-run': z.boolean().optional(),
  n: z.boolean().optional(),
  yes: z.boolean().optional(),
  y: z.boolean().optional(),
}).strict();

const RestoreOptionsSchema = BaseOptionsSchema.extend({
  clean: z.boolean().optional(),
  'data-only': z.boolean().optional(),
  'dry-run': z.boolean().optional(),
  file: z.string().optional(),
  f: z.string().optional(),
  n: z.boolean().optional(),
  yes: z.boolean().optional(),
  y: z.boolean().optional(),
}).strict();

/**
 * Run db-manager.sh with given arguments, streaming output to console
 */
async function runDbManager(args: string[]): Promise<void> {
  const proc = spawn({
    cmd: ['bash', dbManagerPath, ...args],
    cwd: projectRoot,
    stdin: 'inherit',
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
 * Usage: rcr db backup <prod|dev> [--data-only] [--dry-run]
 */
export const backup: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(BackupOptionsSchema, options);
  const locationArg = args[0];

  if (!locationArg) {
    throw createError('VALIDATION_ERROR', 'Environment required: prod or dev');
  }

  const locationResult = LocationSchema.safeParse(locationArg);
  if (!locationResult.success) {
    throw createError(
      'VALIDATION_ERROR',
      `Invalid environment: ${locationArg}. Must be 'prod' or 'dev'`
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
    throw createError('VALIDATION_ERROR', 'Environment required: prod or dev');
  }

  const locationResult = LocationSchema.safeParse(locationArg);
  if (!locationResult.success) {
    throw createError(
      'VALIDATION_ERROR',
      `Invalid environment: ${locationArg}. Must be 'prod' or 'dev'`
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

  const file = parsedOptions.file ?? parsedOptions.f;
  if (file) {
    shellArgs.push('--file', file);
  }

  if (parsedOptions.yes ?? parsedOptions.y) {
    shellArgs.push('--yes');
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
 * Reset database (dev only)
 * Usage: rcr db reset [dev]
 */
export const reset: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  // Reset is always dev-only
  const locationArg = args[0];
  if (locationArg && locationArg !== 'dev') {
    throw createError('PERMISSION_DENIED', 'Reset is only supported for dev database');
  }

  await runDbManager(['reset', 'dev']);

  return success({
    action: 'reset',
    location: 'dev',
  });
};

/**
 * Seed database with initial data (dev only)
 * Usage: rcr db seed [dev]
 */
export const seed: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  // Seed is always dev-only
  const locationArg = args[0];
  if (locationArg && locationArg !== 'dev') {
    throw createError('PERMISSION_DENIED', 'Seed is only supported for dev database');
  }

  const result = await seedDatabase();

  return success({
    action: 'seed',
    location: 'dev',
    recordsSeeded: result.recordsSeeded,
  });
};

/**
 * Show database status and record counts
 * Usage: rcr db status [prod|dev]
 */
export const status: CommandHandler = async (_args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  // Query counts from database in parallel (sequential queries hang in CLI context)
  const [[recordCount], [linkCount]] = await Promise.all([
    db.select({ count: count() }).from(records),
    db.select({ count: count() }).from(links),
  ]);

  const nodeEnv = process.env.NODE_ENV || 'development';
  const connectedTo = nodeEnv === 'production' ? 'prod' : 'dev';

  return success({
    environment: connectedTo,
    connected: true,
    counts: {
      records: recordCount?.count ?? 0,
      links: linkCount?.count ?? 0,
      predicates: Object.keys(PREDICATES).length,
    },
  });
};

/**
 * Clone production database to development
 * Usage: rcr db clone-prod-to-dev [--dry-run] [--yes|-y]
 */
export const cloneProdToDev: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(BackupOptionsSchema, options);
  const shellArgs: string[] = [];
  const dryRun = parsedOptions['dry-run'] ?? parsedOptions.n ?? false;
  const skipConfirm = parsedOptions.yes ?? parsedOptions.y ?? false;

  if (dryRun) {
    shellArgs.push('--dry-run');
  }

  if (skipConfirm) {
    shellArgs.push('--yes');
  }

  shellArgs.push('clone-prod-to-dev');

  await runDbManager(shellArgs);

  return success({
    action: 'clone-prod-to-dev',
    dryRun,
  });
};

export { cloneProdToDev as 'clone-prod-to-dev' };
