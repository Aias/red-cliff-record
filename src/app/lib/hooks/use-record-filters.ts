import { useSyncExternalStore, useCallback } from 'react';
import type { z } from 'zod';
import type { RecordFiltersSchema } from '@/shared/types';
import { DEFAULT_LIMIT, ListRecordsInputSchema, type ListRecordsInput } from '@/shared/types';

const STORAGE_KEY = 'rcr:record-filters';

// Schema for stored state (no offset - always reset to 0)
const StoredFiltersSchema = ListRecordsInputSchema.omit({ offset: true });
type StoredFilters = z.infer<typeof StoredFiltersSchema>;

// Default state
const defaultState: StoredFilters = {
  filters: {},
  limit: DEFAULT_LIMIT,
  orderBy: [
    { field: 'recordCreatedAt', direction: 'desc' },
    { field: 'id', direction: 'desc' },
  ],
};

// In-memory cache for current value (shared across all hook instances)
let cachedState: StoredFilters = defaultState;
let initialized = false;

// Set of listeners for useSyncExternalStore
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function parseStoredValue(raw: string | null): StoredFilters {
  if (!raw) return defaultState;
  try {
    const parsed = JSON.parse(raw);
    const result = StoredFiltersSchema.safeParse(parsed);
    return result.success ? result.data : defaultState;
  } catch {
    return defaultState;
  }
}

function loadFromStorage(): StoredFilters {
  if (typeof window === 'undefined') return defaultState;
  return parseStoredValue(localStorage.getItem(STORAGE_KEY));
}

function saveToStorage(state: StoredFilters) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  cachedState = state;
  notifyListeners();
}

// Initialize and set up storage listener
function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  cachedState = loadFromStorage();

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cachedState = parseStoredValue(e.newValue);
      notifyListeners();
    }
  });
}

function subscribe(callback: () => void) {
  initialize();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): StoredFilters {
  initialize();
  return cachedState;
}

function getServerSnapshot(): StoredFilters {
  return defaultState;
}

type RecordFilters = z.infer<typeof RecordFiltersSchema>;
type OrderCriteria = ListRecordsInput['orderBy'][number];

export type RecordFiltersState = StoredFilters;

export function useRecordFilters() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFilters = useCallback(
    (filtersOrUpdater: RecordFilters | ((prev: RecordFilters) => RecordFilters)) => {
      const current = getSnapshot();
      const newFilters =
        typeof filtersOrUpdater === 'function'
          ? filtersOrUpdater(current.filters)
          : filtersOrUpdater;
      saveToStorage({ ...current, filters: newFilters });
    },
    []
  );

  const setLimit = useCallback((limit: number) => {
    const current = getSnapshot();
    saveToStorage({ ...current, limit });
  }, []);

  const setOrderBy = useCallback((orderBy: OrderCriteria[]) => {
    const current = getSnapshot();
    saveToStorage({ ...current, orderBy });
  }, []);

  const reset = useCallback(() => {
    saveToStorage(defaultState);
  }, []);

  return {
    state,
    setFilters,
    setLimit,
    setOrderBy,
    reset,
  };
}
