/**
 * Factory for creating localStorage-backed external stores compatible
 * with `useSyncExternalStore`. Handles in-memory caching, listener
 * notification, lazy initialization, and cross-tab sync via the
 * `storage` event.
 */
export function createLocalStorageStore<T>(options: {
  key: string;
  defaultValue: T;
  parse: (raw: string | null) => T;
}) {
  let cached: T = options.defaultValue;
  let initialized = false;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function initialize() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;
    cached =
      typeof window === 'undefined'
        ? options.defaultValue
        : options.parse(localStorage.getItem(options.key));

    window.addEventListener('storage', (e) => {
      if (e.key === options.key) {
        cached = options.parse(e.newValue);
        notify();
      }
    });
  }

  function getSnapshot(): T {
    initialize();
    return cached;
  }

  function set(value: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(options.key, JSON.stringify(value));
    cached = value;
    notify();
  }

  return {
    subscribe(callback: () => void) {
      initialize();
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getSnapshot,
    getServerSnapshot(): T {
      return options.defaultValue;
    },
    set,
    get: getSnapshot,
  };
}
