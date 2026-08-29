import { Effect, Layer } from 'effect';
import { adobeIntegration } from '../adobe/sync';
import { raindropIntegration } from '../raindrop/sync';
import { readwiseIntegration } from '../readwise/sync';
import { debugSinkCapture } from './debug';
import { CurrentRun, withRun, type IntegrationDef } from './run';

const registry = {
  adobe: adobeIntegration,
  raindrop: raindropIntegration,
  readwise: readwiseIntegration,
} satisfies Record<string, IntegrationDef>;

export type RegisteredIntegration = keyof typeof registry;

export const isRegisteredIntegration = (name: string): name is RegisteredIntegration =>
  name in registry;

/**
 * Runs a single integration sync. Normal mode wraps the work in run tracking;
 * debug mode swaps in the capturing DebugSink, creates no run row, and
 * persists nothing.
 */
export const syncOne = (name: RegisteredIntegration, options: { readonly debug: boolean }) => {
  const def = registry[name];
  const sync = options.debug
    ? def.sync.pipe(
        Effect.provide(Layer.succeed(CurrentRun, { runId: null })),
        Effect.provide(debugSinkCapture(name))
      )
    : withRun(def.integrationType, def.sync);
  return sync.pipe(Effect.annotateLogs({ integration: name }), Effect.withLogSpan(name));
};
