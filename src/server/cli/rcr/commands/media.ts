/**
 * Media commands for the CLI
 *
 * These are thin wrappers around tRPC procedures,
 * reusing all query logic from the API routers.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { MediaTypeSchema } from '@hozo';
import { TRPCError } from '@trpc/server';
import { lookup } from 'mime-types';
import { z } from 'zod';
import { IdSchema, LimitSchema, OffsetSchema } from '@/shared/types/api';
import { BaseOptionsSchema, parseId, parseIds, parseJsonInput, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

// Media-specific order fields (must match router)
const MediaOrderByFieldSchema = z.enum(['recordCreatedAt', 'recordUpdatedAt', 'id']);

/**
 * CLI options schema for listing media
 */
const MediaListOptionsSchema = BaseOptionsSchema.extend({
  limit: LimitSchema.optional(),
  offset: OffsetSchema.optional(),
  type: MediaTypeSchema.optional(),
  'alt-text': z.boolean().optional(),
  record: z.coerce.number().positive().int().optional(),
  order: MediaOrderByFieldSchema.optional(),
  direction: z.enum(['asc', 'desc']).optional(),
}).strict();

const MediaGetOptionsSchema = BaseOptionsSchema.extend({
  'with-record': z.boolean().optional(),
}).strict();

const MediaCreateOptionsSchema = BaseOptionsSchema.extend({
  record: IdSchema,
  file: z.string().optional(),
  url: z.url().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
}).strict();

/**
 * Get media item(s) by ID
 * Usage: rcr media get <id...> [--with-record]
 */
export const get: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(MediaGetOptionsSchema, options);
  const ids = parseIds(args);
  const includeRecord = parsedOptions['with-record'] ?? false;

  if (ids.length === 0) {
    throw createError('VALIDATION_ERROR', 'At least one ID is required');
  }

  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return await caller.media.get({ id, includeRecord });
      } catch (e) {
        if (e instanceof TRPCError && e.code === 'NOT_FOUND') {
          return { id, error: 'NOT_FOUND' as const };
        }
        throw e;
      }
    })
  );

  if (ids.length === 1) {
    const result = results[0];
    if (result && 'error' in result) {
      throw createError('NOT_FOUND', `Media ${ids[0]} not found`);
    }
    return success(result);
  }

  return success(results, { count: results.length });
};

/**
 * List media with filters
 * Usage: rcr media list [--type=image] [--alt-text=false] [--record=123] [--order=recordCreatedAt] [--direction=desc] [--limit=50] [--offset=0]
 */
export const list: CommandHandler = async (_args, options) => {
  const parsedOptions = parseOptions(MediaListOptionsSchema, options);

  const input = {
    type: parsedOptions.type,
    hasAltText: parsedOptions['alt-text'],
    recordId: parsedOptions.record,
    limit: parsedOptions.limit ?? 50,
    offset: parsedOptions.offset ?? 0,
    orderBy: parsedOptions.order
      ? [{ field: parsedOptions.order, direction: parsedOptions.direction ?? 'desc' }]
      : undefined,
  };

  const results = await caller.media.list(input);
  return success(results, {
    count: results.length,
    limit: input.limit,
    offset: input.offset,
  });
};

/**
 * Schema for media update input
 */
const MediaUpdateSchema = z.object({
  altText: z.string().nullable().optional(),
});

/**
 * Update media metadata
 * Usage: rcr media update <id> '<json>'
 * Example: rcr media update 123 '{"altText": "A photo of a sunset"}'
 */
export const update: CommandHandler = async (args, options) => {
  parseOptions(BaseOptionsSchema.strict(), options);
  const id = parseId(args);
  const input = await parseJsonInput(MediaUpdateSchema, args.slice(1));

  try {
    const result = await caller.media.update({ id, ...input });
    return success(result);
  } catch (e) {
    if (e instanceof TRPCError) {
      if (e.code === 'NOT_FOUND') {
        throw createError('NOT_FOUND', `Media ${id} not found`);
      }
      throw createError('VALIDATION_ERROR', e.message);
    }
    throw e;
  }
};

/**
 * Create media by uploading a file or URL
 * Usage:
 *   rcr media create --record <id> --file <path> [--name <filename>] [--type <mime>]
 *   rcr media create --record <id> --url <url> [--name <filename>] [--type <mime>]
 */
export const create: CommandHandler = async (args, options) => {
  if (args.length > 0) {
    throw createError(
      'VALIDATION_ERROR',
      'Unexpected positional args. Use --file or --url options.'
    );
  }

  const parsedOptions = parseOptions(MediaCreateOptionsSchema, options);
  const { record, file, url, name, type } = parsedOptions;

  if (file && url) {
    throw createError('VALIDATION_ERROR', 'Use either --file or --url, not both.');
  }
  if (!file && !url) {
    throw createError('VALIDATION_ERROR', 'Missing --file or --url.');
  }

  if (url) {
    try {
      const result = await caller.media.create({ recordId: record, url });
      return success(result);
    } catch (e) {
      if (e instanceof TRPCError) {
        throw createError('VALIDATION_ERROR', e.message);
      }
      throw e;
    }
  }

  if (!file) {
    throw createError('VALIDATION_ERROR', 'Missing --file or --url.');
  }

  let fileBuffer: Buffer;
  let fileName = name ?? '';
  let fileType = type ?? '';

  fileBuffer = await readFile(file);
  if (!fileName) fileName = basename(file);
  if (!fileType) {
    const detectedType = lookup(fileName);
    if (typeof detectedType === 'string') fileType = detectedType;
  }

  if (!fileType) {
    throw createError('VALIDATION_ERROR', 'Unable to determine file type; provide --type.');
  }
  if (!fileName) fileName = 'media';

  try {
    const result = await caller.media.create({
      recordId: record,
      fileData: fileBuffer.toString('base64'),
      fileName,
      fileType,
    });
    return success(result);
  } catch (e) {
    if (e instanceof TRPCError) {
      throw createError('VALIDATION_ERROR', e.message);
    }
    throw e;
  }
};

const GenerateAltOptionsSchema = BaseOptionsSchema.extend({
  force: z.boolean().optional(),
}).strict();

/**
 * Generate alt text for media items using OpenAI vision
 * Usage: rcr media generate-alt <id...> [--force]
 * Example: rcr media generate-alt 123 456 789 --force
 */
const generateAlt: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(GenerateAltOptionsSchema, options);
  const ids = parseIds(args);

  if (ids.length === 0) {
    throw createError('VALIDATION_ERROR', 'At least one ID is required');
  }

  const results = await caller.media.generateAltText({
    ids,
    force: parsedOptions.force ?? false,
  });

  // Transform to CLI-compatible format
  const data = results.map((r) => ({
    mediaId: r.mediaId,
    recordId: r.recordId ?? null,
    recordTitle: r.recordTitle ?? null,
    success: r.success,
    skipped: r.skipped ?? false,
    altText: r.altText ?? null,
    error: r.error ?? null,
  }));

  const summary = {
    total: results.length,
    generated: results.filter((r) => r.success && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.success).length,
  };

  return success(data, summary);
};

export { generateAlt as 'generate-alt' };
