import { appendFile } from 'node:fs/promises';
import { Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import superjson from 'superjson';
import { z } from 'zod';
import { ReadwiseCleanupSnapshotSchema } from '@/server/integrations/readwise/cleanup/apply';
import { cleanupDocuments, listCleanupParents } from '@/server/integrations/readwise/cleanup/sync';
import { ReadwiseCleanupPreviewSchema } from '@/shared/readwise-cleanup';
import { idArgument, positiveIntFlag } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { respond, respondWith, success } from '../lib/output';

const caller = createCLICaller();

const SnapshotLineSchema = z.object({
  documentId: z.string(),
  recordId: z.int().positive(),
  recordIds: z.array(z.int().positive()),
  snapshot: ReadwiseCleanupSnapshotSchema,
});

const preview = Command.make(
  'preview',
  {
    id: idArgument().pipe(Argument.withDescription('Readwise document record ID')),
    editorial: Flag.Boolean('editorial').pipe(
      Flag.withDescription('Include editorial changes'),
      Flag.withDefault(false)
    ),
  },
  ({ id, editorial }) =>
    respond(async () => success(await caller.records.previewReadwiseCleanup({ id, editorial })))
).pipe(
  Command.withDescription('Preview the cleanup changes for one document'),
  Command.withExamples([
    { command: 'rcr readwise preview 123 --raw > preview.json', description: 'Save a preview' },
  ])
);

const apply = Command.make(
  'apply',
  {
    file: Argument.String('file').pipe(
      Argument.withDescription('Preview JSON file created with --raw')
    ),
    record: positiveIntFlag('record').pipe(
      Flag.withDescription('Record ID whose changes to apply; repeatable'),
      Flag.atLeast(1)
    ),
  },
  ({ file, record }) =>
    respond(async () => {
      const { changes } = ReadwiseCleanupPreviewSchema.parse(await Bun.file(file).json());
      return success(
        await caller.records.applyReadwiseCleanup({
          changes: changes.filter((change) => record.includes(change.target.id)),
        })
      );
    })
).pipe(
  Command.withDescription('Apply selected changes from a saved preview'),
  Command.withExamples([{ command: 'rcr readwise apply preview.json --record 12 --record 34' }])
);

const cleanup = Command.make(
  'cleanup',
  {
    since: Flag.Date('since').pipe(
      Flag.withDescription('Only documents saved on or after this date'),
      Flag.optional
    ),
    until: Flag.Date('until').pipe(
      Flag.withDescription('Only documents saved on or before this date'),
      Flag.optional
    ),
    limit: positiveIntFlag('limit').pipe(
      Flag.withDescription('Maximum documents to process'),
      Flag.optional
    ),
    dryRun: Flag.Boolean('dry-run').pipe(
      Flag.withDescription('Report changes without applying them'),
      Flag.withDefault(false)
    ),
    snapshots: Flag.String('snapshots').pipe(
      Flag.withDescription('JSONL file for undo snapshots; defaults to a timestamped file'),
      Flag.optional
    ),
  },
  ({ since, until, limit, dryRun, snapshots }) =>
    respondWith(
      Effect.gen(function* () {
        const allParents = yield* Effect.tryPromise({
          try: () => listCleanupParents(Option.getOrUndefined(since), Option.getOrUndefined(until)),
          catch: (cause) => cause,
        });
        const parents = allParents.slice(0, Option.getOrUndefined(limit));
        const snapshotsPath = Option.getOrElse(
          snapshots,
          () => `readwise-cleanup-${new Date().toISOString().replaceAll(':', '-')}.jsonl`
        );
        const { results, failures } = yield* cleanupDocuments(parents, {
          dryRun,
          onApplied: (result) => appendFile(snapshotsPath, `${superjson.stringify(result)}\n`),
        });
        const applied = results.filter((result) => result.snapshot);
        return success({
          dryRun,
          documents: parents.length,
          documentsWithChanges: results.filter((result) => result.recordIds.length).length,
          records: results.reduce((sum, result) => sum + result.recordIds.length, 0),
          failures: failures.map(({ label, message }) => ({ label, message })),
          snapshots: applied.length ? snapshotsPath : null,
        });
      })
    )
).pipe(
  Command.withDescription('Clean up Readwise highlight documents and write undo snapshots'),
  Command.withExamples([
    {
      command: 'rcr readwise cleanup --since 2026-01-01 --limit 20 --dry-run',
      description: 'Dry run over recent documents',
    },
  ])
);

const undo = Command.make(
  'undo',
  {
    file: Argument.String('file').pipe(
      Argument.withDescription('Snapshots file written by `rcr readwise cleanup`')
    ),
  },
  ({ file }) =>
    respond(async () => {
      const lines = (await Bun.file(file).text()).split('\n').filter(Boolean);
      const restoredRecordIds: number[] = [];
      for (const line of lines.toReversed()) {
        const { snapshot } = SnapshotLineSchema.parse(superjson.parse(line));
        const undone = await caller.records.undoReadwiseCleanup({ snapshot });
        restoredRecordIds.push(...undone.restoredRecordIds);
      }
      return success({ documents: lines.length, restoredRecordIds });
    })
).pipe(Command.withDescription('Restore records from a cleanup snapshots file, newest first'));

export const readwise = Command.make('readwise').pipe(
  Command.withDescription('Readwise highlight cleanup'),
  Command.withSubcommands([preview, apply, cleanup, undo])
);
