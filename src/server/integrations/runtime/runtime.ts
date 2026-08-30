import type { IntegrationType } from '@hozo';
import { Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';
import { databaseLayer } from './db';
import { debugSinkDisabled } from './debug';
import { DbError } from './errors';
import { syncOne, type RegisteredIntegration, type SyncOneOptions } from './registry';
import { causeMessage, runTrackerLayer, withRun, type SyncSummary } from './run';

const rateLimiterLayer = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

const appLayers = Layer.mergeAll(
  databaseLayer,
  debugSinkDisabled,
  FetchHttpClient.layer,
  rateLimiterLayer,
  runTrackerLayer.pipe(Layer.provide(databaseLayer))
);

export const runAppEffect = async <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof appLayers>>,
  signal?: AbortSignal
): Promise<A> => {
  const runtime = ManagedRuntime.make(appLayers);
  try {
    const exit = await runtime.runPromiseExit(effect, { signal });
    if (Exit.isSuccess(exit)) return exit.value;
    throw new Error(causeMessage(exit.cause));
  } finally {
    await runtime.dispose();
  }
};

export const runIntegrationSync = (
  name: RegisteredIntegration,
  options: SyncOneOptions & { readonly signal?: AbortSignal }
): Promise<SyncSummary> => runAppEffect(syncOne(name, options), options.signal);

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
