/**
 * Browsing history commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { z } from 'zod';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DailyOptionsSchema = BaseOptionsSchema.extend({}).strict();

/**
 * Get daily browsing summary
 * Usage: rcr browsing daily <date>
 * Example: rcr browsing daily 2026-01-03
 */
export const daily: CommandHandler = async (args, options) => {
	parseOptions(DailyOptionsSchema, options);

	const date = args[0];
	if (!date) {
		throw createError('VALIDATION_ERROR', 'Date is required (format: YYYY-MM-DD)');
	}

	const parsedDate = DateSchema.safeParse(date);
	if (!parsedDate.success) {
		throw createError('VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD');
	}

	const result = await caller.browsing.dailySummary({ date: parsedDate.data });

	return success(result);
};

/**
 * List all omit patterns
 * Usage: rcr browsing omit
 */
export const omit: CommandHandler = async (_args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	const result = await caller.browsing.listOmitPatterns();

	return success(result, { count: result.length });
};

/**
 * Add a pattern to the omit list
 * Usage: rcr browsing omit-add <pattern>
 * Example: rcr browsing omit-add "%example.com%"
 */
const omitAdd: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	const pattern = args[0];
	if (!pattern) {
		throw createError('VALIDATION_ERROR', 'Pattern is required (SQL LIKE syntax: % for wildcard)');
	}

	const result = await caller.browsing.upsertOmitPattern({ pattern });

	return success(result);
};

/**
 * Delete patterns from the omit list
 * Usage: rcr browsing omit-delete <pattern...>
 * Example: rcr browsing omit-delete "%example.com%" "%test.com%"
 */
const omitDelete: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);

	if (args.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one pattern is required');
	}

	const result = await caller.browsing.deleteOmitPatterns(args);

	return success(result, { count: result.length });
};

export { omitAdd as 'omit-add', omitDelete as 'omit-delete' };
