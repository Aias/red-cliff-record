import { syncOne, type RegisteredIntegration, type SyncOneOptions } from './registry';
import { runAppEffect } from './runtime';

export const runIntegrationSync = (
  name: RegisteredIntegration,
  options: SyncOneOptions & { readonly signal?: AbortSignal }
) => runAppEffect(syncOne(name, options), options.signal);
