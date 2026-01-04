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
	type DateRange,
	type ListRecordsInput,
	DateSchema,
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

/**
 * Parse CLI date range syntax into DateRange object.
 * Supports:
 *   "2026-01-03"           → { from: "2026-01-03", to: "2026-01-03" } (exact)
 *   "2026-01-01..2026-01-03" → { from: "2026-01-01", to: "2026-01-03" } (range)
 *   "..2026-01-03"         → { to: "2026-01-03" } (before/until)
 *   "2026-01-03.."         → { from: "2026-01-03" } (after/since)
 */
const DateRangeStringSchema = z.string().transform((val, ctx): DateRange => {
	if (val.includes('..')) {
		const [fromPart, toPart] = val.split('..');
		const from = fromPart?.trim() || undefined;
		const to = toPart?.trim() || undefined;

		// Validate individual date parts
		if (from) {
			const result = DateSchema.safeParse(from);
			if (!result.success) {
				ctx.addIssue({ code: 'custom', message: `Invalid 'from' date: ${from}` });
				return z.NEVER;
			}
		}
		if (to) {
			const result = DateSchema.safeParse(to);
			if (!result.success) {
				ctx.addIssue({ code: 'custom', message: `Invalid 'to' date: ${to}` });
				return z.NEVER;
			}
		}
		if (!from && !to) {
			ctx.addIssue({ code: 'custom', message: 'Date range must have at least one bound' });
			return z.NEVER;
		}

		return { from, to };
	}

	// Single date = exact date (from and to are the same)
	const result = DateSchema.safeParse(val);
	if (!result.success) {
		ctx.addIssue({ code: 'custom', message: `Invalid date: ${val}` });
		return z.NEVER;
	}
	return { from: val, to: val };
});

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
	created: DateRangeStringSchema.optional(),
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
				created: opts.created,
			},
			limit: opts.limit ?? DEFAULT_LIMIT,
			offset: opts.offset ?? 0,
			orderBy: [{ field: 'recordCreatedAt', direction: 'desc' }],
		})
	);

const RecordsGetOptionsSchema = BaseOptionsSchema.extend({
	links: z.boolean().optional(),
}).strict();

/**
 * Get record(s) by ID
 * Usage: rcr records get <id...> [--links]
 */
export const get: CommandHandler = async (args, options) => {
	const parsedOptions = parseOptions(RecordsGetOptionsSchema, options);
	const ids = parseIds(args);
	const includeLinks = parsedOptions.links ?? false;

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one ID is required');
	}

	// Fetch records and optionally links in parallel
	const [recordResults, linksMap] = await Promise.all([
		Promise.all(
			ids.map(async (id) => {
				try {
					return await caller.records.get({ id });
				} catch (e) {
					if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
						return { id, error: 'NOT_FOUND' as const };
					}
					throw e;
				}
			})
		),
		includeLinks && ids.length > 0 ? caller.links.map({ recordIds: ids }) : Promise.resolve(null),
	]);

	// Merge links into records if requested
	const results = recordResults.map((record) => {
		if ('error' in record) return record;
		if (!linksMap) return record;

		const links = linksMap[record.id];
		return {
			...record,
			incomingLinks: links?.incomingLinks ?? [],
			allOutgoingLinks: links?.outgoingLinks ?? [],
		};
	});

	// Single ID: return the record directly (or throw if not found)
	if (ids.length === 1) {
		const result = results[0];
		if (result && 'error' in result) {
			throw createError('NOT_FOUND', `Record ${ids[0]} not found`);
		}
		return success(result);
	}

	// Multiple IDs: return array with count
	return success(results, { count: results.length });
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
 * Generate embedding for record(s)
 * Usage: rcr records embed <id...>
 */
export const embed: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const ids = parseIds(args);

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one ID is required');
	}

	const results = await Promise.all(
		ids.map(async (id) => {
			try {
				return await caller.records.embed({ id });
			} catch (e) {
				if (e instanceof TRPCError) {
					if (e.code === 'NOT_FOUND') {
						return { id, error: 'NOT_FOUND' };
					}
					return { id, error: e.message };
				}
				throw e;
			}
		})
	);

	if (ids.length === 1) {
		const result = results[0];
		if (result && 'error' in result) {
			if (result.error === 'NOT_FOUND') {
				throw createError('NOT_FOUND', `Record ${ids[0]} not found`);
			}
			throw createError('EMBEDDING_ERROR', result.error);
		}
		return success(result);
	}

	return success(results, { count: results.length });
};

/**
 * Get hierarchical family tree for record(s)
 * Usage: rcr records tree <id...>
 */
export const tree: CommandHandler = async (args, options) => {
	parseOptions(BaseOptionsSchema.strict(), options);
	const ids = parseIds(args);

	if (ids.length === 0) {
		throw createError('VALIDATION_ERROR', 'At least one ID is required');
	}

	const results = await Promise.all(
		ids.map(async (id) => {
			try {
				return await caller.records.tree({ id });
			} catch (e) {
				if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
					return { id, error: 'NOT_FOUND' };
				}
				throw e;
			}
		})
	);

	if (ids.length === 1) {
		const result = results[0];
		if (result && 'error' in result) {
			throw createError('NOT_FOUND', `Record ${ids[0]} not found`);
		}
		return success(result);
	}

	return success(results, { count: results.length });
};
