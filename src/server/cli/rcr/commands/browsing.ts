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
