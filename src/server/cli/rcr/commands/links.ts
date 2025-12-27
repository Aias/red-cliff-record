/**
 * Links commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { TRPCError } from '@trpc/server';
import { parseId, parseIds, parseJsonInput } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * List all links for a record
 * Usage: rcr links list <record-id>
 */
export const list: CommandHandler = async (args, _options) => {
	const id = parseId(args);

	try {
		const result = await caller.links.listForRecord({ id });
		return success(result);
	} catch (e) {
		if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
			throw createError('NOT_FOUND', `Record ${id} not found`);
		}
		throw e;
	}
};

/**
 * Create or update a link
 * Usage: rcr links create '<json>' or echo '<json>' | rcr links create
 * JSON format: { sourceId: number, targetId: number, predicateId: number, notes?: string }
 */
export const create: CommandHandler = async (args, _options) => {
	const input = await parseJsonInput(args);

	try {
		const link = await caller.links.upsert(input as Parameters<typeof caller.links.upsert>[0]);
		return success(link);
	} catch (e) {
		if (e instanceof TRPCError) {
			if (e.code === 'NOT_FOUND') {
				throw createError('NOT_FOUND', e.message);
			}
			if (e.code === 'BAD_REQUEST') {
				throw createError('VALIDATION_ERROR', e.message);
			}
		}
		throw e;
	}
};

/**
 * Delete link(s)
 * Usage: rcr links delete <id...>
 */
export const del: CommandHandler = async (args, _options) => {
	const ids = parseIds(args);

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one link ID is required');
	}

	const result = await caller.links.delete(ids);
	return success(result, { count: result.length });
};
export { del as delete };

/**
 * List all available predicate types
 * Usage: rcr links predicates
 */
export const predicates: CommandHandler = async (_args, _options) => {
	const result = await caller.links.listPredicates();
	return success(result, { count: result.length });
};
