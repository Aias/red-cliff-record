/**
 * Links commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { LinkInsertSchema } from '@aias/hozo';
import { TRPCError } from '@trpc/server';
import { BaseOptionsSchema, parseIds, parseJsonInput, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * List all links for record(s)
 * Usage: rcr links list <record-id...>
 */
export const list: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const ids = parseIds(args);

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one record ID is required');
	}

	// Single ID: use listForRecord for detailed output
	const [firstId] = ids;
	if (ids.length === 1 && firstId !== undefined) {
		try {
			const result = await caller.links.listForRecord({ id: firstId });
			return success(result);
		} catch (e) {
			if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
				throw createError('NOT_FOUND', `Record ${firstId} not found`);
			}
			throw e;
		}
	}

	// Multiple IDs: use the efficient map procedure
	const result = await caller.links.map({ recordIds: ids });
	return success(result, { count: Object.keys(result).length });
};

/**
 * Create or update a link
 * Usage: rcr links create '<json>' or echo '<json>' | rcr links create
 * JSON format: { sourceId: number, targetId: number, predicateId: number, notes?: string }
 */
export const create: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const input = await parseJsonInput(LinkInsertSchema, args);

	try {
		const link = await caller.links.upsert(input);
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
export const del: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
export const predicates: CommandHandler = async (_args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const result = await caller.links.listPredicates();
	return success(result, { count: result.length });
};
