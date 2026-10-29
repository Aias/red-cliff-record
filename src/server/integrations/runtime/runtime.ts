import type { IntegrationType } from '@hozo';
import { Effect, Exit, Layer, Logger, ManagedRuntime } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { RateLimiter } from 'effect/persistence';
import { databaseLayer } from './db';
import { debugSinkDisabled } from './debug';
import { DbError } from './errors';
import { causeMessage, runTrackerLayer, withRun, type SyncSummary } from './run';

const rateLimiterLayer = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

export const appLayer = Layer.mergeAll(
  databaseLayer,
  debugSinkDisabled,
  FetchHttpClient.layer,
  rateLimiterLayer,
  runTrackerLayer.pipe(Layer.provide(databaseLayer)),
  Layer.succeed(Logger.LogToStderr, true)
);

export const runAppEffect = async <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof appLayer>>,
  signal?: AbortSignal
): Promise<A> => {
  const runtime = ManagedRuntime.make(appLayer);
  try {
    const exit = await runtime.runPromiseExit(effect, { signal });
    if (Exit.isSuccess(exit)) return exit.value;
    throw new Error(causeMessage(exit.cause));
  } finally {
    await runtime.dispose();
  }
};

export const runTrackedEnrichment = (
  integrationType: IntegrationType,
  operation: string,
  work: () => Promise<number>,
  signal?: AbortSignal
): Promise<SyncSummary> =>
  runAppEffect(
    withRun(
      integrationType,
      Effect.tryPromise({
        try: work,
        catch: (cause) => new DbError({ operation, cause }),
      }).pipe(Effect.map((entriesCreated) => ({ entriesCreated, failures: [] })))
    ).pipe(Effect.annotateLogs({ integration: operation }), Effect.withLogSpan(operation)),
    signal
  );
