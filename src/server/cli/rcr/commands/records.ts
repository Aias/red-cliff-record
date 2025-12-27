/**
 * Records commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { IntegrationTypeSchema, RecordInsertSchema, RecordTypeSchema } from '@aias/hozo';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
	type ListRecordsInput,
	DEFAULT_LIMIT,
	LimitSchema,
	OffsetSchema,
	RecordFiltersSchema,
} from '@/shared/types';
import { BaseOptionsSchema, parseId, parseIds, parseJsonInput, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

/**
 * CLI options schema that transforms to ListRecordsInput.
 * Derives validation rules from shared RecordFiltersSchema.
 */
const RecordsListOptionsSchema = BaseOptionsSchema.extend({
	limit: LimitSchema.optional(),
	offset: OffsetSchema.optional(),
	type: RecordTypeSchema.optional(),
	title: RecordFiltersSchema.shape.title.unwrap().optional(),
	text: RecordFiltersSchema.shape.text.unwrap().optional(),
	url: RecordFiltersSchema.shape.url.unwrap().optional(),
	source: IntegrationTypeSchema.optional(),
	curated: z.boolean().optional(),
	private: z.boolean().optional(),
	'rating-min': RecordFiltersSchema.shape.minRating.optional(),
	'rating-max': RecordFiltersSchema.shape.maxRating.optional(),
	embedding: z.boolean().optional(),
	media: z.boolean().optional(),
	parent: z.boolean().optional(),
})
	.strict()
	.transform(
		(opts): ListRecordsInput => ({
			filters: {
				types: opts.type ? [opts.type] : undefined,
				title: opts.title,
				text: opts.text,
				url: opts.url,
				isCurated: opts.curated,
				isPrivate: opts.private,
				minRating: opts['rating-min'],
				maxRating: opts['rating-max'],
				hasEmbedding: opts.embedding,
				hasMedia: opts.media,
				hasParent: opts.parent,
				sources: opts.source ? [opts.source] : undefined,
			},
			limit: opts.limit ?? DEFAULT_LIMIT,
			offset: opts.offset ?? 0,
			orderBy: [{ field: 'recordCreatedAt', direction: 'desc' }],
		})
	);

/**
 * Get a single record by ID
 * Usage: rcr records get <id>
 */
export const get: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
	const input = parseOptions(RecordsListOptionsSchema, options);
	const result = await caller.records.list(input);
	return success(result.ids, {
		count: result.ids.length,
		limit: input.limit,
		offset: input.offset,
	});
};

/**
 * Create a new record
 * Usage: rcr records create '<json>' or echo '<json>' | rcr records create
 */
export const create: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const input = await parseJsonInput(RecordInsertSchema, args);

	try {
		const record = await caller.records.upsert(input);
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
export const update: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const id = parseId(args);
	const input = await parseJsonInput(RecordInsertSchema, args.slice(1));

	try {
		const record = await caller.records.upsert({ ...input, id });
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
export const del: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
export const merge: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
export const embed: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
export const tree: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
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
