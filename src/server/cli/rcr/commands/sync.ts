import { Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/cli';
import { checkDatabaseConnection } from '@/server/db/connections/postgres';
import { describeError } from '@/server/integrations/runtime/errors';
import {
  syncOne,
  type RegisteredIntegration,
  type SyncOneOptions,
} from '@/server/integrations/runtime/registry';
import { runFormatEnrichment } from '@/server/services/classify-record-format';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { createError } from '../lib/errors';
import { respondWith, success } from '../lib/output';

const INTEGRATIONS = [
  'github',
  'github-commits',
  'readwise',
  'raindrop',
  'adobe',
  'browsing',
  'twitter',
] as const satisfies ReadonlyArray<RegisteredIntegration>;
type IntegrationName = (typeof INTEGRATIONS)[number];

const DAILY_INTEGRATIONS: ReadonlyArray<IntegrationName> = [
  'browsing',
  'raindrop',
  'readwise',
  'twitter',
  'github',
];

const syncIntegration = (integration: IntegrationName, options: SyncOneOptions) =>
  Effect.gen(function* () {
    const startTime = performance.now();
    const summaries =
      integration === 'github'
        ? [yield* syncOne('github-commits', options), yield* syncOne('github', options)]
        : [yield* syncOne(integration, options)];
    return {
      integration,
      success: true,
      entriesCreated: summaries.reduce((total, summary) => total + summary.entriesCreated, 0),
      failedItems: summaries.reduce((total, summary) => total + summary.failures.length, 0),
      duration: Math.round(performance.now() - startTime),
    };
  });

const enrichSince = (since: Date) =>
  Effect.tryPromise({
    try: async (signal) => {
      await runSaveAvatarsIntegration(signal);
      await runAltTextIntegration({ signal });
      await runEmbedRecordsIntegration(signal);
      await runFormatEnrichment({ signal, since });
    },
    catch: (cause) => cause,
  });

type StepResult = { step: string; success: boolean; error?: string };

const toStepResult = <E, R>(step: string, work: Effect.Effect<unknown, E, R>) =>
  work.pipe(
    Effect.match({
      onFailure: (error): StepResult => ({ step, success: false, error: describeError(error) }),
      onSuccess: (): StepResult => ({ step, success: true }),
    })
  );

const dailySync = (options: SyncOneOptions, startedAt: Date) =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(
      DAILY_INTEGRATIONS,
      (integration) => toStepResult(integration, syncIntegration(integration, options)),
      { concurrency: 'unbounded' }
    );
    if (!options.debug) results.push(yield* toStepResult('enrich', enrichSince(startedAt)));
    const succeeded = results.filter((result) => result.success).length;
    return success({
      results,
      summary: { total: results.length, succeeded, failed: results.length - succeeded },
    });
  });

export const sync = Command.make(
  'sync',
  {
    integration: Argument.Literals('integration', INTEGRATIONS).pipe(
      Argument.withDescription('Integration to sync; omit to run every daily sync'),
      Argument.optional
    ),
    allowNewHostname: Flag.Boolean('allow-new-hostname').pipe(
      Flag.withDescription('Allow browser history sync from a hostname not seen before'),
      Flag.withDefault(false)
    ),
    debug: Flag.Boolean('debug').pipe(
      Flag.withDescription('Capture API responses without writing records; skips enrichment'),
      Flag.withDefault(false)
    ),
  },
  ({ integration, allowNewHostname, debug }) =>
    respondWith(
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: checkDatabaseConnection,
          catch: (cause) => createError('DATABASE_ERROR', describeError(cause)),
        });
        const options = { debug, allowNewHostname };
        const startedAt = new Date();
        if (Option.isNone(integration)) return yield* dailySync(options, startedAt);
        const result = yield* syncIntegration(integration.value, options);
        if (!debug) yield* enrichSince(startedAt);
        return success(result);
      })
    )
).pipe(
  Command.withDescription(
    'Run integration syncs, then enrich records created since the sync started'
  ),
  Command.withExamples([
    { command: 'rcr sync', description: 'Run every daily sync and enrichment' },
    { command: 'rcr sync readwise', description: 'Sync Readwise only' },
  ])
);
