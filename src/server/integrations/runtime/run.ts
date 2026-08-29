import {
  integrationRuns,
  IntegrationStatusSchema,
  RunTypeSchema,
  type IntegrationType,
  type RunType,
} from '@hozo';
import { eq } from 'drizzle-orm';
import { Cause, Context, Effect, Exit, Layer, Option, Result } from 'effect';
import type { HttpClient } from 'effect/unstable/http';
import { Database } from './db';
import type { DebugSink } from './debug';
import { DbError, describeError, type IntegrationError } from './errors';

export interface ItemFailure {
  readonly label: string;
  readonly message: string;
}

export interface SyncSummary {
  readonly entriesCreated: number;
  readonly failures: ReadonlyArray<ItemFailure>;
}

/**
 * The active integration run. `runId` is null in debug mode, where no
 * `integration_runs` row is created and nothing is persisted.
 */
export class CurrentRun extends Context.Service<
  CurrentRun,
  {
    readonly runId: number | null;
  }
>()('integrations/CurrentRun') {}

/**
 * The run id for persistence paths. Staging tables require a real run id, and
 * persistence must never execute in debug mode — reaching this without a run
 * row is a bug, so it dies rather than failing.
 */
export const requireRunId = Effect.gen(function* () {
  const { runId } = yield* CurrentRun;
  if (runId === null) {
    return yield* Effect.die(new Error('Persistence requires an active integration run'));
  }
  return runId;
});

export type SyncEnv = Database | DebugSink | CurrentRun | HttpClient.HttpClient;

export interface IntegrationDef {
  readonly integrationType: IntegrationType;
  readonly sync: Effect.Effect<SyncSummary, IntegrationError, SyncEnv>;
}

export const causeMessage = <E>(cause: Cause.Cause<E>): string => {
  const error = Cause.findErrorOption(cause);
  if (Option.isSome(error)) return describeError(error.value);
  if (Cause.hasInterrupts(cause)) return 'Interrupted';
  return Cause.pretty(cause);
};

const startRun = (integrationType: IntegrationType, runType: RunType) =>
  Effect.gen(function* () {
    const database = yield* Database;
    const rows = yield* database.use('integration_runs.insert', (client) =>
      client
        .insert(integrationRuns)
        .values({ integrationType, runType, runStartTime: new Date() })
        .returning()
    );
    const run = rows[0];
    if (!run) {
      return yield* new DbError({
        operation: 'integration_runs.insert',
        cause: 'no row returned',
      });
    }
    yield* Effect.logInfo(`Created integration run ${run.id}`);
    return run.id;
  });

const finishRun = (
  runId: number,
  fields: {
    status: (typeof IntegrationStatusSchema.enum)[keyof typeof IntegrationStatusSchema.enum];
    runEndTime: Date;
    entriesCreated?: number;
    message?: string | null;
  }
) =>
  Effect.gen(function* () {
    const database = yield* Database;
    yield* database.use('integration_runs.update', (client) =>
      client.update(integrationRuns).set(fields).where(eq(integrationRuns.id, runId))
    );
  });

const failureSummaryMessage = (failures: ReadonlyArray<ItemFailure>): string | null => {
  const [first] = failures;
  if (!first) return null;
  return `${failures.length} item(s) failed. First: ${first.label}: ${first.message}`;
};

/**
 * Tracks a sync in `integration_runs`: inserts the row before the work runs
 * and finalizes it on success, failure, and interrupt. Feedbin reads these
 * rows as its incremental-sync cursor, so the row semantics must not change.
 */
export const withRun = <A extends SyncSummary, E, R>(
  integrationType: IntegrationType,
  work: Effect.Effect<A, E, R>,
  runType: RunType = RunTypeSchema.enum.sync
) =>
  Effect.gen(function* () {
    const runId = yield* Effect.acquireRelease(startRun(integrationType, runType), (id, exit) =>
      Exit.isSuccess(exit)
        ? Effect.void
        : finishRun(id, {
            status: IntegrationStatusSchema.enum.fail,
            runEndTime: new Date(),
            message: causeMessage(exit.cause),
          }).pipe(Effect.catch((error) => Effect.logError('Failed to record run failure', error)))
    );
    const summary = yield* work.pipe(Effect.provide(Layer.succeed(CurrentRun, { runId })));
    yield* finishRun(runId, {
      status: IntegrationStatusSchema.enum.success,
      runEndTime: new Date(),
      entriesCreated: summary.entriesCreated,
      message: failureSummaryMessage(summary.failures),
    });
    return summary;
  }).pipe(Effect.scoped);

/**
 * Runs a worker over every item with bounded concurrency, collecting failures
 * instead of aborting: one bad item never kills the sync, but every failure is
 * logged and surfaced in the summary. Defects still propagate — a thrown bug
 * is systemic, not an item failure.
 */
export const forEachCollect = <A, X, E, R>(
  items: ReadonlyArray<A>,
  options: {
    readonly concurrency: number;
    readonly label: (item: A) => string;
    readonly worker: (item: A) => Effect.Effect<X, E, R>;
  }
): Effect.Effect<{ successes: Array<X>; failures: Array<ItemFailure> }, never, R> =>
  Effect.gen(function* () {
    const results = yield* Effect.forEach(
      items,
      (item) => options.worker(item).pipe(Effect.result),
      { concurrency: options.concurrency }
    );
    const successes: Array<X> = [];
    const failures: Array<ItemFailure> = [];
    for (const [index, result] of results.entries()) {
      if (Result.isSuccess(result)) {
        successes.push(result.success);
      } else {
        const item = items[index];
        const failure = {
          label: item === undefined ? `#${index}` : options.label(item),
          message: describeError(result.failure),
        };
        failures.push(failure);
        yield* Effect.logWarning(`Item failed: ${failure.label}: ${failure.message}`);
      }
    }
    return { successes, failures };
  });
