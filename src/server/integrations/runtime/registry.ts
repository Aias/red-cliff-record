import { Effect, Layer } from 'effect';
import { adobeIntegration } from '../adobe/sync';
import { AllowNewHostname, browserHistoryIntegration } from '../browser-history/sync';
import { feedbinIntegration } from '../feedbin/sync';
import { githubCommitsIntegration, githubIntegration } from '../github/sync';
import { raindropIntegration } from '../raindrop/sync';
import { readwiseIntegration } from '../readwise/sync';
import { twitterIntegration } from '../twitter/sync';
import { debugSinkCapture } from './debug';
import { CurrentRun, withRun, type IntegrationDef } from './run';

const registry = {
  adobe: adobeIntegration,
  browsing: browserHistoryIntegration,
  feedbin: feedbinIntegration,
  github: githubIntegration,
  'github-commits': githubCommitsIntegration,
  raindrop: raindropIntegration,
  readwise: readwiseIntegration,
  twitter: twitterIntegration,
} satisfies Record<string, IntegrationDef>;

export type RegisteredIntegration = keyof typeof registry;

export const isRegisteredIntegration = (name: string): name is RegisteredIntegration =>
  name in registry;

export interface SyncOneOptions {
  readonly debug: boolean;
  readonly allowNewHostname?: boolean;
}

export const syncOne = (name: RegisteredIntegration, options: SyncOneOptions) => {
  const def = registry[name];
  const base = options.allowNewHostname
    ? Effect.provideService(def.sync, AllowNewHostname, true)
    : def.sync;
  const sync = options.debug
    ? base.pipe(
        Effect.provide(Layer.succeed(CurrentRun, { runId: null })),
        Effect.provide(debugSinkCapture(name))
      )
    : withRun(def.integrationType, base);
  return sync.pipe(Effect.annotateLogs({ integration: name }), Effect.withLogSpan(name));
};
