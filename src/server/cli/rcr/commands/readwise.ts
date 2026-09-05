import { appendFile } from 'node:fs/promises';
import superjson from 'superjson';
import { z } from 'zod';
import { ReadwiseCleanupSnapshotSchema } from '@/server/integrations/readwise/cleanup/apply';
import { cleanupDocuments, listCleanupParents } from '@/server/integrations/readwise/cleanup/sync';
import { runAppEffect } from '@/server/integrations/runtime/runtime';
import { ReadwiseCleanupPreviewSchema } from '@/shared/readwise-cleanup';
import { BaseOptionsSchema, CommaSeparatedIdsSchema, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { withInterruptSignal } from '../lib/interrupt';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

const SnapshotLineSchema = z.object({
  documentId: z.string(),
  recordId: z.int().positive(),
  recordIds: z.array(z.int().positive()),
  snapshot: ReadwiseCleanupSnapshotSchema,
});

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
  if (!path) {
    throw createError('VALIDATION_ERROR', 'Provide a preview JSON file created with --raw.');
  }
  const { changes } = ReadwiseCleanupPreviewSchema.parse(await Bun.file(path).json());
  return success(
    await caller.records.applyReadwiseCleanup({
      changes: changes.filter((change) => records.includes(change.target.id)),
    })
  );
};

export const cleanup: CommandHandler = (_args, options) =>
  withInterruptSignal(async (signal) => {
    const parsed = parseOptions(
      BaseOptionsSchema.extend({
        since: z.coerce.date().optional(),
        until: z.coerce.date().optional(),
        limit: z.coerce.number().int().positive().optional(),
        'dry-run': z.boolean().default(false),
        snapshots: z.string().optional(),
      }).strict(),
      options
    );
    const dryRun = parsed['dry-run'];
    const parents = (await listCleanupParents(parsed.since, parsed.until)).slice(0, parsed.limit);
    const snapshots =
      parsed.snapshots ?? `readwise-cleanup-${new Date().toISOString().replaceAll(':', '-')}.jsonl`;
    const { results, failures } = await runAppEffect(
      cleanupDocuments(parents, {
        dryRun,
        onApplied: (result) => appendFile(snapshots, `${superjson.stringify(result)}\n`),
      }),
      signal
    );
    const applied = results.filter((result) => result.snapshot);
    return success({
      dryRun,
      documents: parents.length,
      documentsWithChanges: results.filter((result) => result.recordIds.length).length,
      records: results.reduce((sum, result) => sum + result.recordIds.length, 0),
      failures: failures.map(({ label, message }) => ({ label, message })),
      snapshots: applied.length ? snapshots : null,
    });
  });

export const undo: CommandHandler = async (args) => {
  const path = args[0];
  if (!path) {
    throw createError(
      'VALIDATION_ERROR',
      'Provide a snapshots file written by rcr readwise cleanup.'
    );
  }
  const lines = (await Bun.file(path).text()).split('\n').filter(Boolean);
  const restoredRecordIds: number[] = [];
  for (const line of lines.toReversed()) {
    const { snapshot } = SnapshotLineSchema.parse(superjson.parse(line));
    const undone = await caller.records.undoReadwiseCleanup({ snapshot });
    restoredRecordIds.push(...undone.restoredRecordIds);
  }
  return success({ documents: lines.length, restoredRecordIds });
};
