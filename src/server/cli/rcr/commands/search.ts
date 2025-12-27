/**
 * Search commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import type { RecordType } from '@aias/hozo';
import { TRPCError } from '@trpc/server';
import { parseId } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * Full-text trigram search
 * Usage: rcr search text <query> [--type=...] [--limit=...]
 */
export const text: CommandHandler = async (args, options) => {
	const query = args.join(' ');
	if (!query) {
		throw createError('VALIDATION_ERROR', 'Search query is required');
	}

	const limit = typeof options.limit === 'number' ? options.limit : 20;
	const recordType = options.type as RecordType | undefined;

	const results = await caller.search.byTextQuery({
		query,
		filters: { recordType },
		limit,
	});

	return success(results, { count: results.length, limit });
};

/**
 * Semantic vector search using embeddings
 * Usage: rcr search semantic <query> [--limit=...] [--exclude=id,id,...]
 */
export const semantic: CommandHandler = async (args, options) => {
	const query = args.join(' ');
	if (!query) {
		throw createError('VALIDATION_ERROR', 'Search query is required');
	}

	const limit = typeof options.limit === 'number' ? options.limit : 20;

	// Parse exclude list
	let exclude: number[] | undefined;
	if (typeof options.exclude === 'string') {
		exclude = options.exclude
			.split(',')
			.map((s) => parseInt(s.trim(), 10))
			.filter((n) => !isNaN(n));
	}

	try {
		const results = await caller.search.byVector({
			query,
			limit,
			exclude,
		});

		return success(results, { count: results.length, limit });
	} catch (e) {
		if (e instanceof TRPCError) {
			throw createError('EMBEDDING_ERROR', e.message);
		}
		throw e;
	}
};

/**
 * Find records similar to a given record ID
 * Usage: rcr search similar <id> [--limit=...]
 */
export const similar: CommandHandler = async (args, options) => {
	const id = parseId(args);
	const limit = typeof options.limit === 'number' ? options.limit : 20;

	try {
		const results = await caller.search.byRecordId({ id, limit });
		return success(results, { count: results.length, limit });
	} catch (e) {
		if (e instanceof TRPCError) {
			if (e.code === 'NOT_FOUND') {
				throw createError('NOT_FOUND', `Record ${id} not found`);
			}
			throw createError('EMBEDDING_ERROR', e.message);
		}
		throw e;
	}
};
