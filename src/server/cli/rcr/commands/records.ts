/**
 * Records commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import type { RecordType } from '@aias/hozo';
import { TRPCError } from '@trpc/server';
import { parseId, parseIds, parseJsonInput } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * Get a single record by ID
 * Usage: rcr records get <id>
 */
export const get: CommandHandler = async (args, _options) => {
	const id = parseId(args);

	try {
		const record = await caller.records.get({ id });
		return success(record);
	} catch (e) {
		if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
			throw createError('NOT_FOUND', `Record ${id} not found`);
		}
		throw e;
	}
};

/**
 * List records with filters
 * Usage: rcr records list [--type=...] [--title=...] [--limit=...] [--offset=...]
 */
export const list: CommandHandler = async (_args, options) => {
	const limit = typeof options.limit === 'number' ? options.limit : 50;
	const offset = typeof options.offset === 'number' ? options.offset : 0;

	const filters: Record<string, unknown> = {};

	if (options.type) filters.type = options.type as RecordType;
	if (typeof options.title === 'string') filters.title = options.title;
	if (typeof options.text === 'string') filters.text = options.text;
	if (typeof options.url === 'string') filters.url = options.url;
	if (typeof options.source === 'string') filters.source = options.source;
	if (options.curated === true) filters.isCurated = true;
	if (options.private === true) filters.isPrivate = true;
	if (typeof options['rating-min'] === 'number') filters.minRating = options['rating-min'];
	if (typeof options['rating-max'] === 'number') filters.maxRating = options['rating-max'];
	if (options.embedding === true) filters.hasEmbedding = true;
	if (options.embedding === false) filters.hasEmbedding = false;
	if (options.media === true) filters.hasMedia = true;
	if (options.parent === true) filters.hasParent = true;
	if (options.parent === false) filters.hasParent = false;

	const result = await caller.records.list({
		filters,
		limit,
		offset,
		orderBy: [{ field: 'recordCreatedAt', direction: 'desc' }],
	});

	return success(result.ids, { count: result.ids.length, limit, offset });
};

/**
 * Create a new record
 * Usage: rcr records create '<json>' or echo '<json>' | rcr records create
 */
export const create: CommandHandler = async (args, _options) => {
	const input = await parseJsonInput(args);

	try {
		const record = await caller.records.upsert(
			input as Parameters<typeof caller.records.upsert>[0]
		);
		return success(record);
	} catch (e) {
		if (e instanceof TRPCError) {
			throw createError('VALIDATION_ERROR', e.message);
		}
		throw e;
	}
};

/**
 * Update an existing record
 * Usage: rcr records update <id> '<json>'
 */
export const update: CommandHandler = async (args, _options) => {
	const id = parseId(args);
	const input = await parseJsonInput(args.slice(1));

	try {
		const record = await caller.records.upsert({
			...(input as Record<string, unknown>),
			id,
		});
		return success(record);
	} catch (e) {
		if (e instanceof TRPCError) {
			if (e.code === 'NOT_FOUND') {
				throw createError('NOT_FOUND', `Record ${id} not found`);
			}
			throw createError('VALIDATION_ERROR', e.message);
		}
		throw e;
	}
};

/**
 * Delete record(s)
 * Usage: rcr records delete <id...>
 */
export const del: CommandHandler = async (args, _options) => {
	const ids = parseIds(args);

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one ID is required');
	}

	const result = await caller.records.delete(ids);
	return success(result, { count: result.length });
};
export { del as delete };

/**
 * Merge source record into target
 * Usage: rcr records merge <source-id> <target-id>
 */
export const merge: CommandHandler = async (args, _options) => {
	const sourceId = parseId(args, 0);
	const targetId = parseId(args, 1);

	if (sourceId === targetId) {
		throw createError('VALIDATION_ERROR', 'Source and target cannot be the same record');
	}

	try {
		const result = await caller.records.merge({ sourceId, targetId });
		return success(result);
	} catch (e) {
		if (e instanceof TRPCError) {
			if (e.code === 'NOT_FOUND') {
				throw createError('NOT_FOUND', e.message);
			}
			throw createError('CONFLICT', e.message);
		}
		throw e;
	}
};

/**
 * Generate embedding for a record
 * Usage: rcr records embed <id>
 */
export const embed: CommandHandler = async (args, _options) => {
	const id = parseId(args);

	try {
		const result = await caller.records.embed({ id });
		return success(result);
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

/**
 * Get hierarchical family tree for a record
 * Usage: rcr records tree <id>
 */
export const tree: CommandHandler = async (args, _options) => {
	const id = parseId(args);

	try {
		const result = await caller.records.tree({ id });
		return success(result);
	} catch (e) {
		if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
			throw createError('NOT_FOUND', `Record ${id} not found`);
		}
		throw e;
	}
};
