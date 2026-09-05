import { z } from 'zod';
import { ReadwiseCleanupPreviewSchema } from '@/shared/readwise-cleanup';
import { BaseOptionsSchema, CommaSeparatedIdsSchema, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

export const preview: CommandHandler = async (args, options) => {
  const { editorial } = parseOptions(
    BaseOptionsSchema.extend({ editorial: z.boolean().default(false) }).strict(),
    options
  );
  const id = z.coerce.number().int().positive().parse(args[0]);
  return success(await caller.records.previewReadwiseCleanup({ id, editorial }));
};

export const apply: CommandHandler = async (args, options) => {
  const { records } = parseOptions(
    BaseOptionsSchema.extend({ records: CommaSeparatedIdsSchema }).strict(),
    options
  );
  const path = args[0];
  if (!path)
    throw createError('VALIDATION_ERROR', 'Provide a preview JSON file created with --raw.');
  const cleanup = ReadwiseCleanupPreviewSchema.parse(await Bun.file(path).json());
  return success(
    await caller.records.applyReadwiseCleanup({ preview: cleanup, recordIds: records })
  );
};
