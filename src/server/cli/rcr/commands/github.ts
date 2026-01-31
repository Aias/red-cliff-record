/**
 * GitHub commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { DateSchema } from '@/shared/types/api';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * Get daily commit summary
 * Usage: rcr github daily <date>
 * Example: rcr github daily 2026-01-03
 */
export const daily: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  const date = args[0];
  if (!date) {
    throw createError('VALIDATION_ERROR', 'Date is required (format: YYYY-MM-DD)');
  }

  const parsedDate = DateSchema.safeParse(date);
  if (!parsedDate.success) {
    throw createError('VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD');
  }

  const result = await caller.github.dailySummary({ date: parsedDate.data });

  return success(result, { count: result.commits.length });
};

/**
 * Get a single commit by ID with full details
 * Usage: rcr github get <id>
 * Example: rcr github get abc123
 */
export const get: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  const id = args[0];
  if (!id) {
    throw createError('VALIDATION_ERROR', 'Commit ID is required');
  }

  const result = await caller.github.getCommit({ id });

  return success(result);
};
