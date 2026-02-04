/**
 * Records commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { IntegrationTypeSchema, RecordInsertSchema, RecordTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  DEFAULT_LIMIT,
  LimitSchema,
  OffsetSchema,
  OrderCriteriaSchema,
  RecordFiltersSchema,
  type ListRecordsInput,
} from '@/shared/types/api';
import { BaseOptionsSchema, parseId, parseIds, parseJsonInput, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

/**
 * Parse comma-separated values into an array, validating each against the schema.
 * Returns undefined if the input is undefined.
 */
function parseCommaSeparated<T>(value: string | undefined, schema: z.ZodType<T>): T[] | undefined {
  if (value === undefined) return undefined;
  const items = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) return undefined;
  return items.map((item) => schema.parse(item));
}

/**
 * Parse order string like "createdAt:desc,rating:asc" into OrderCriteria array
 */
function parseOrderString(
  value: string | undefined
): z.infer<typeof OrderCriteriaSchema>[] | undefined {
  if (!value) return undefined;
  const criteria = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return criteria.map((criterion) => {
    const [field, direction = 'desc'] = criterion.split(':');
    return OrderCriteriaSchema.parse({ field, direction });
  });
}

const caller = createCLICaller();

/**
 * CLI options schema that transforms to ListRecordsInput.
 * Derives validation rules from shared RecordFiltersSchema.
 *
 * Boolean filters support: --flag (true), --flag=true, --flag=false
 * Array filters support comma-separated values: --type=entity,concept
 * Order supports: --order=field:direction,field2:direction2
 */
const RecordsListOptionsSchema = BaseOptionsSchema.extend({
  limit: LimitSchema.optional(),
  offset: OffsetSchema.optional(),
  // Array filters (comma-separated)
  type: z.string().optional(), // Parsed as comma-separated, e.g., "entity,concept"
  source: z.string().optional(), // Parsed as comma-separated, e.g., "readwise,github"
  // Text filters
  title: RecordFiltersSchema.shape.title.unwrap().optional(),
  text: RecordFiltersSchema.shape.text.unwrap().optional(),
  url: RecordFiltersSchema.shape.url.unwrap().optional(),
  // Boolean filters (support =true/=false)
  curated: z.boolean().optional(),
  private: z.boolean().optional(),
  embedding: z.boolean().optional(),
  media: z.boolean().optional(),
  parent: z.boolean().optional(),
  'has-title': z.boolean().optional(),
  // Range filters
  'rating-min': RecordFiltersSchema.shape.minRating.optional(),
  'rating-max': RecordFiltersSchema.shape.maxRating.optional(),
  // Ordering
  order: z.string().optional(), // e.g., "createdAt:desc,rating:asc"
  // Output options
  full: z.boolean().optional(), // Return full records instead of just IDs
})
  .strict()
  .transform((opts): ListRecordsInput & { full?: boolean } => ({
    filters: {
      types: parseCommaSeparated(opts.type, RecordTypeSchema),
      sources: parseCommaSeparated(opts.source, IntegrationTypeSchema),
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
      hasTitle: opts['has-title'],
    },
    limit: opts.limit ?? DEFAULT_LIMIT,
    offset: opts.offset ?? 0,
    orderBy: parseOrderString(opts.order) ?? [{ field: 'recordCreatedAt', direction: 'desc' }],
    full: opts.full,
  }));

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
 * Usage: rcr records list [--type=...] [--source=...] [--order=...] [--full] [--limit=...] [--offset=...]
 *
 * Supports comma-separated values for --type and --source:
 *   --type=entity,concept --source=readwise,github
 *
 * Supports ordering with --order=field:direction (comma-separated for multiple):
 *   --order=rating:desc,createdAt:asc
 *
 * Use --full to return complete record objects instead of just IDs.
 */
export const list: CommandHandler = async (_args, options) => {
  const { full, ...input } = parseOptions(RecordsListOptionsSchema, options);
  const result = await caller.records.list(input);

  // If --full is requested, fetch complete records
  if (full && result.ids.length > 0) {
    const ids = result.ids.map((r) => r.id);
    const records = await Promise.all(
      ids.map(async (id) => {
        try {
          return await caller.records.get({ id });
        } catch {
          return { id, error: 'NOT_FOUND' as const };
        }
      })
    );
    return success(records, {
      count: records.length,
      limit: input.limit,
      offset: input.offset,
    });
  }

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

// Schema for bulk update data (matches API schema)
const BulkUpdateDataSchema = RecordInsertSchema.omit({
  id: true,
  slug: true,
  sources: true,
  textEmbedding: true,
}).partial();

/**
 * Bulk update records
 * Usage: rcr records bulk-update <id,...> '<json-data>'
 *
 * First argument is comma-separated IDs, second is the data to apply to all.
 *
 * Examples:
 *   rcr records bulk-update 1,2,3 '{"isCurated": true}'
 *   rcr records bulk-update 5,10,15 '{"rating": 3, "isPrivate": false}'
 */
export const bulkUpdate: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);

  if (args.length < 2) {
    throw createError('VALIDATION_ERROR', 'Usage: rcr records bulk-update <id,...> <json-data>');
  }

  const ids = parseIds(args[0]?.split(',') ?? []);
  if (ids.length === 0) {
    throw createError('VALIDATION_ERROR', 'At least one ID is required');
  }

  const data = await parseJsonInput(BulkUpdateDataSchema, args.slice(1));

  try {
    const updatedIds = await caller.records.bulkUpdate({ ids, data });
    return success(updatedIds, { count: updatedIds.length });
  } catch (e) {
    if (e instanceof TRPCError) {
      throw createError('VALIDATION_ERROR', e.message);
    }
    throw e;
  }
};
// Alias for kebab-case CLI convention
export { bulkUpdate as 'bulk-update' };

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

/**
 * Get children of a record (records with contained_by links to this record)
 * Usage: rcr records children <id>
 *
 * This is a convenience wrapper around `tree` that returns just the children.
 */
export const children: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);
  const id = parseId(args);

  try {
    const tree = await caller.records.tree({ id });
    const children = tree.incomingLinks.map((link) => ({
      id: link.source.id,
      title: link.source.title,
      recordCreatedAt: link.source.recordCreatedAt,
      predicate: link.predicate,
    }));
    return success({ parentId: id, children }, { count: children.length });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
      throw createError('NOT_FOUND', `Record ${id} not found`);
    }
    throw e;
  }
};

/**
 * Get the parent of a record (the target of its contained_by link)
 * Usage: rcr records parent <id>
 *
 * This is a convenience wrapper around `tree` that returns just the parent.
 */
export const parent: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);
  const id = parseId(args);

  try {
    const tree = await caller.records.tree({ id });
    const parentLink = tree.outgoingLinks[0];
    if (!parentLink) {
      return success({ childId: id, parent: null });
    }
    return success({
      childId: id,
      parent: {
        id: parentLink.target.id,
        title: parentLink.target.title,
        recordCreatedAt: parentLink.target.recordCreatedAt,
        predicate: parentLink.predicate,
      },
    });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
      throw createError('NOT_FOUND', `Record ${id} not found`);
    }
    throw e;
  }
};
