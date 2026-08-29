import { useSyncExternalStore } from 'react';

// Tracks the initial Zero preload of the synced graph. On a fresh replica
// (a first visit, or after a deploy that changes the synced schema) the
// local store starts empty, so until the preload completes an empty local
// read means "not synced yet", not "no data".
const { promise, resolve } = Promise.withResolvers<void>();
let synced = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => synced;
const getServerSnapshot = () => false;

/** Mark the initial preload as fully arrived. Idempotent. */
export function markSynced(): void {
  if (synced) return;
  synced = true;
  resolve();
  for (const listener of listeners) listener();
}

/** Resolves once the initial preload of the synced graph has completed. */
export function whenSynced(): Promise<void> {
  return promise;
}

/** Whether the initial preload of the synced graph has completed. */
export function useSynced(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
