import { realpathSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { links, PREDICATES, records } from '@hozo';
import { spawn } from 'bun';
import { count } from 'drizzle-orm';
import { Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { db } from '@/server/db/connections/postgres';
import { seedDatabase } from '@/server/db/seed';
import { getDatabaseUrl } from '@/server/lib/db-url';
import { createError } from '../lib/errors';
import { respond, success } from '../lib/output';

// Resolve project root from this file's location (src/server/cli/rcr/commands/db.ts -> project root)
const scriptPath = fileURLToPath(import.meta.url);
const realScriptPath = realpathSync(scriptPath);
const projectRoot = resolve(dirname(realScriptPath), '../../../../..');
const dbManagerPath = resolve(projectRoot, 'src/server/db/db-manager.sh');

const targetArgument = Argument.Literals('target', ['prod', 'dev']).pipe(
  Argument.withDescription('Database to operate on')
);
const devTargetArgument = Argument.Literals('target', ['dev']).pipe(
  Argument.withDescription('Only the dev database is supported'),
  Argument.optional
);
const dryRunFlag = Flag.Boolean('dry-run').pipe(
  Flag.withAlias('n'),
  Flag.withDescription('Print the commands without executing them'),
  Flag.withDefault(false)
);
const dataOnlyFlag = Flag.Boolean('data-only').pipe(
  Flag.withDescription('Include table data only, without schema'),
  Flag.withDefault(false)
);
const yesFlag = Flag.Boolean('yes').pipe(
  Flag.withAlias('y'),
  Flag.withDescription('Skip the confirmation prompt'),
  Flag.withDefault(false)
);

const enabledFlags = (flags: Record<string, boolean>) =>
  Object.entries(flags).flatMap(([name, enabled]) => (enabled ? [`--${name}`] : []));

/** Run db-manager.sh with given arguments, streaming its output to stderr */
async function runDbManager(args: string[], signal: AbortSignal) {
  const proc = spawn({
    cmd: ['bash', dbManagerPath, ...args],
    cwd: projectRoot,
    stdin: 'inherit',
    stdout: Bun.stderr,
    stderr: 'inherit',
    signal,
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw createError('DATABASE_ERROR', `db-manager.sh exited with code ${exitCode}`);
  }
}

const backup = Command.make(
  'backup',
  { target: targetArgument, dataOnly: dataOnlyFlag, dryRun: dryRunFlag },
  ({ target, dataOnly, dryRun }) =>
    respond(async (signal) => {
      await runDbManager(
        [...enabledFlags({ 'data-only': dataOnly, 'dry-run': dryRun }), 'backup', target],
        signal
      );
      return success({ action: 'backup', location: target, dataOnly, dryRun });
    })
).pipe(
  Command.withDescription('Back up a database'),
  Command.withExamples([{ command: 'rcr db backup dev --dry-run' }])
);

const restore = Command.make(
  'restore',
  {
    target: targetArgument,
    clean: Flag.Boolean('clean').pipe(
      Flag.withDescription('Drop and recreate the database before restoring'),
      Flag.withDefault(false)
    ),
    dataOnly: dataOnlyFlag,
    dryRun: dryRunFlag,
    file: Flag.File('file').pipe(
      Flag.withAlias('f'),
      Flag.withDescription('Backup file to restore; defaults to the most recent backup'),
      Flag.optional
    ),
    yes: yesFlag,
  },
  ({ target, clean, dataOnly, dryRun, file, yes }) =>
    respond(async (signal) => {
      await runDbManager(
        [
          ...enabledFlags({ clean, 'data-only': dataOnly, 'dry-run': dryRun }),
          ...Option.match(file, { onNone: () => [], onSome: (path) => ['--file', path] }),
          ...enabledFlags({ yes }),
          'restore',
          target,
        ],
        signal
      );
      return success({ action: 'restore', location: target, clean, dataOnly, dryRun });
    })
).pipe(
  Command.withDescription('Restore a database from a backup'),
  Command.withExamples([{ command: 'rcr db restore dev --file path/to/file.dump --yes' }])
);

const reset = Command.make('reset', { target: devTargetArgument }, () =>
  respond(async (signal) => {
    await runDbManager(['reset', 'dev'], signal);
    return success({ action: 'reset', location: 'dev' });
  })
).pipe(Command.withDescription('Drop and recreate the dev database'));

const seed = Command.make('seed', { target: devTargetArgument }, () =>
  respond(async () => {
    const result = await seedDatabase();
    return success({ action: 'seed', location: 'dev', recordsSeeded: result.recordsSeeded });
  })
).pipe(Command.withDescription('Seed the dev database with predicates'));

const status = Command.make('status', {}, () =>
  respond(async () => {
    // Sequential queries hang in CLI context
    const [[recordCount], [linkCount]] = await Promise.all([
      db.select({ count: count() }).from(records),
      db.select({ count: count() }).from(links),
    ]);

    return success({
      environment: getDatabaseUrl() === process.env.DATABASE_URL_DEV ? 'dev' : 'prod',
      connected: true,
      counts: {
        records: recordCount?.count ?? 0,
        links: linkCount?.count ?? 0,
        predicates: Object.keys(PREDICATES).length,
      },
    });
  })
).pipe(Command.withDescription('Show the connected environment and record counts'));

const cloneProdToDev = Command.make(
  'clone-prod-to-dev',
  { dryRun: dryRunFlag, yes: yesFlag },
  ({ dryRun, yes }) =>
    respond(async (signal) => {
      await runDbManager(
        [...enabledFlags({ 'dry-run': dryRun, yes }), 'clone-prod-to-dev'],
        signal
      );
      return success({ action: 'clone-prod-to-dev', dryRun });
    })
).pipe(Command.withDescription('Replace the dev database with a copy of production'));

const dbGroup = Command.make('db').pipe(
  Command.withDescription('Manage the database'),
  Command.withSubcommands([backup, restore, reset, seed, status, cloneProdToDev])
);

export { dbGroup as db };
