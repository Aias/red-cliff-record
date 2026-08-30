import { Effect, Layer } from 'effect';
import { adobeIntegration } from '../adobe/sync';
import { feedbinIntegration } from '../feedbin/sync';
import { githubCommitsIntegration, githubIntegration } from '../github/sync';
import { raindropIntegration } from '../raindrop/sync';
import { readwiseIntegration } from '../readwise/sync';
import { debugSinkCapture } from './debug';
import { CurrentRun, withRun, type IntegrationDef } from './run';

const registry = {
  adobe: adobeIntegration,
  feedbin: feedbinIntegration,
  github: githubIntegration,
  'github-commits': githubCommitsIntegration,
  raindrop: raindropIntegration,
  readwise: readwiseIntegration,
} satisfies Record<string, IntegrationDef>;

export type RegisteredIntegration = keyof typeof registry;

export const isRegisteredIntegration = (name: string): name is RegisteredIntegration =>
  name in registry;

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
