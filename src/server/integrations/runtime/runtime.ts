import { Exit, Layer, ManagedRuntime } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { databaseLayer } from './db';
import { debugSinkDisabled } from './debug';
import { syncOne, type RegisteredIntegration } from './registry';
import { causeMessage, type SyncSummary } from './run';

const appLayers = Layer.mergeAll(databaseLayer, debugSinkDisabled, FetchHttpClient.layer);

/**
 * Promise boundary for the non-Effect CLI: builds the runtime, runs one sync,
 * and disposes. Failures reject with a plain Error carrying a readable message.
 */
export const runIntegrationSync = async (
  name: RegisteredIntegration,
  options: { readonly debug: boolean }
): Promise<SyncSummary> => {
  const runtime = ManagedRuntime.make(appLayers);
  try {
    const exit = await runtime.runPromiseExit(syncOne(name, options));
    if (Exit.isSuccess(exit)) return exit.value;
    throw new Error(causeMessage(exit.cause));
  } finally {
    await runtime.dispose();
  }
};
