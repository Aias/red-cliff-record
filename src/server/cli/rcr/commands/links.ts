/**
 * Links commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { LinkInsertSchema, PREDICATES, predicateSlugs, type PredicateSlug } from '@hozo';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { BaseOptionsSchema, parseId, parseIds, parseJsonInput, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

const LinksListOptionsSchema = BaseOptionsSchema.extend({
  predicate: z.enum(predicateSlugs as [PredicateSlug, ...PredicateSlug[]]).optional(),
  direction: z.enum(['incoming', 'outgoing']).optional(),
}).strict();

/**
 * List links for a record with optional filtering
 * Usage: rcr links list <record-id> [--predicate=<slug>] [--direction=incoming|outgoing]
 *
 * Examples:
 *   rcr links list 123                           # All links for record 123
 *   rcr links list 123 --predicate=contained_by  # Only contained_by links
 *   rcr links list 123 --direction=outgoing      # Only outgoing links
 *   rcr links list 123 --predicate=contained_by --direction=outgoing  # Parent link
 */
export const list: CommandHandler = async (args, options) => {
  const opts = parseOptions(LinksListOptionsSchema, options);
  const id = parseId(args);

  try {
    const result = await caller.links.listForRecord({ id });

    // Apply filters
    let outgoing = result.outgoingLinks;
    let incoming = result.incomingLinks;

    if (opts.predicate) {
      outgoing = outgoing.filter((l) => l.predicate === opts.predicate);
      incoming = incoming.filter((l) => l.predicate === opts.predicate);
    }

    if (opts.direction === 'outgoing') {
      incoming = [];
    } else if (opts.direction === 'incoming') {
      outgoing = [];
    }

    const filtered = {
      id: result.id,
      outgoingLinks: outgoing,
      incomingLinks: incoming,
    };

    return success(filtered, { count: outgoing.length + incoming.length });
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
  const result = Object.values(PREDICATES);
  return await Promise.resolve(success(result, { count: result.length }));
};
