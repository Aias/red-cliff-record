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
import type { RateLimiter } from 'effect/unstable/persistence';
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

export class CurrentRun extends Context.Service<
  CurrentRun,
  {
    readonly runId: number | null;
  }
>()('integrations/CurrentRun') {}

export const requireRunId = Effect.gen(function* () {
  const { runId } = yield* CurrentRun;
  if (runId === null) {
    return yield* Effect.die(new Error('Persistence requires an active integration run'));
  }
  return runId;
});

export type SyncEnv =
  | Database
  | DebugSink
  | CurrentRun
  | HttpClient.HttpClient
  | RateLimiter.RateLimiter;

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

export interface RunCompletion {
  readonly status: (typeof IntegrationStatusSchema.enum)[keyof typeof IntegrationStatusSchema.enum];
  readonly runEndTime: Date;
  readonly entriesCreated?: number;
  readonly message?: string | null;
}

export class RunTracker extends Context.Service<
  RunTracker,
  {
    readonly start: (
      integrationType: IntegrationType,
      runType: RunType
    ) => Effect.Effect<number, DbError>;
    readonly finish: (runId: number, fields: RunCompletion) => Effect.Effect<void, DbError>;
  }
>()('integrations/RunTracker') {}

export const runTrackerLayer = Layer.effect(
  RunTracker,
  Effect.gen(function* () {
    const database = yield* Database;
    return {
      start: (integrationType, runType) =>
        Effect.gen(function* () {
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
        }),
      finish: (runId, fields) =>
        database
          .use('integration_runs.update', (client) =>
            client.update(integrationRuns).set(fields).where(eq(integrationRuns.id, runId))
          )
          .pipe(Effect.asVoid),
    };
  })
);

const failureSummaryMessage = (failures: ReadonlyArray<ItemFailure>): string | null => {
  const [first] = failures;
  if (!first) return null;
  return `${failures.length} item(s) failed. First: ${first.label}: ${first.message}`;
};

export const withRun = <A extends SyncSummary, E, R>(
  integrationType: IntegrationType,
  work: Effect.Effect<A, E, R>,
  runType: RunType = RunTypeSchema.enum.sync
) =>
  Effect.gen(function* () {
    const tracker = yield* RunTracker;
    const runId = yield* Effect.acquireRelease(
      tracker.start(integrationType, runType),
      (id, exit) =>
        Exit.isSuccess(exit)
          ? Effect.void
          : tracker
              .finish(id, {
                status: IntegrationStatusSchema.enum.fail,
                runEndTime: new Date(),
                message: causeMessage(exit.cause),
              })
              .pipe(Effect.catch((error) => Effect.logError('Failed to record run failure', error)))
    );
    const summary = yield* work.pipe(Effect.provide(Layer.succeed(CurrentRun, { runId })));
    yield* tracker.finish(runId, {
      status: IntegrationStatusSchema.enum.success,
      runEndTime: new Date(),
      entriesCreated: summary.entriesCreated,
      message: failureSummaryMessage(summary.failures),
    });
    return summary;
  }).pipe(Effect.scoped);

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
