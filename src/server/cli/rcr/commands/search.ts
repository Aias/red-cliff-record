/**
 * Search commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { RecordTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import {
  BaseOptionsSchema,
  CommaSeparatedIdsSchema,
  LimitSchema,
  parseIds,
  parseOptions,
} from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

const SearchLimitOptionsSchema = BaseOptionsSchema.extend({
  limit: LimitSchema.optional(),
}).strict();

const SearchTextOptionsSchema = BaseOptionsSchema.extend({
  limit: LimitSchema.optional(),
  type: RecordTypeSchema.optional(),
}).strict();

const SearchSemanticOptionsSchema = BaseOptionsSchema.extend({
  limit: LimitSchema.optional(),
  exclude: CommaSeparatedIdsSchema.optional(),
}).strict();

/**
 * Hybrid search (trigram + vector with RRF merge)
 * Usage: rcr search <query> [--limit=...]
 */
export const hybrid: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(SearchLimitOptionsSchema, options);
  const query = args.join(' ');
  if (!query) {
    throw createError('VALIDATION_ERROR', 'Search query is required');
  }

  const limit = parsedOptions.limit ?? 20;

  const { ids } = await caller.records.list({ searchQuery: query, limit });

  const results = await Promise.all(ids.map(({ id }) => caller.records.get({ id })));

  return success(results, { count: results.length, limit });
};

/**
 * Full-text trigram search
 * Usage: rcr search text <query> [--type=...] [--limit=...]
 */
export const text: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(SearchTextOptionsSchema, options);
  const query = args.join(' ');
  if (!query) {
    throw createError('VALIDATION_ERROR', 'Search query is required');
  }

  const limit = parsedOptions.limit ?? 20;
  const recordType = parsedOptions.type;

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
  const parsedOptions = parseOptions(SearchSemanticOptionsSchema, options);
  const query = args.join(' ');
  if (!query) {
    throw createError('VALIDATION_ERROR', 'Search query is required');
  }

  const limit = parsedOptions.limit ?? 20;
  const exclude = parsedOptions.exclude;

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
 * Find records similar to given record ID(s)
 * Usage: rcr search similar <id...> [--limit=...]
 */
export const similar: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(SearchLimitOptionsSchema, options);
  const ids = parseIds(args);
  const limit = parsedOptions.limit ?? 20;

  if (ids.length === 0) {
    throw createError('VALIDATION_ERROR', 'At least one ID is required');
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        const similar = await caller.search.byRecordId({ id, limit });
        return { id, similar };
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

  // Single ID: return just the similar records array
  if (ids.length === 1) {
    const id = ids[0];
    const result = results[0];
    if (!result || 'error' in result) {
      const errorMsg = result?.error;
      if (errorMsg === 'NOT_FOUND') {
        throw createError('NOT_FOUND', `Record ${id} not found`);
      }
      throw createError('EMBEDDING_ERROR', errorMsg ?? 'Unknown error');
    }
    return success(result.similar, { count: result.similar.length, limit });
  }

  // Multiple IDs: return array of { id, similar } objects
  return success(results, { count: results.length, limit });
};
