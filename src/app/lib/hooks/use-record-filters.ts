import { useCallback, useSyncExternalStore } from 'react';
import type { z } from 'zod';
import {
  DEFAULT_LIMIT,
  ListRecordsInputSchema,
  type ListRecordsInput,
  type RecordFiltersSchema,
} from '@/shared/types/api';
import { createLocalStorageStore } from '../create-local-storage-store';

// Schema for stored state (no offset - always reset to 0)
const StoredFiltersSchema = ListRecordsInputSchema.omit({ offset: true });
type StoredFilters = z.infer<typeof StoredFiltersSchema>;

const defaultState: StoredFilters = {
  filters: {},
  limit: DEFAULT_LIMIT,
  orderBy: [
    { field: 'recordCreatedAt', direction: 'desc' },
    { field: 'id', direction: 'desc' },
  ],
};

const store = createLocalStorageStore<StoredFilters>({
  key: 'rcr:record-filters',
  defaultValue: defaultState,
  parse(raw) {
    if (!raw) return defaultState;
    try {
      const parsed = JSON.parse(raw);
      const result = StoredFiltersSchema.safeParse(parsed);
      return result.success ? result.data : defaultState;
    } catch {
      return defaultState;
    }
  },
});

type RecordFilters = z.infer<typeof RecordFiltersSchema>;
type OrderCriteria = ListRecordsInput['orderBy'][number];

export type RecordFiltersState = StoredFilters;

export function useRecordFilters() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const setFilters = useCallback(
    (filtersOrUpdater: RecordFilters | ((prev: RecordFilters) => RecordFilters)) => {
      const current = store.get();
      const newFilters =
        typeof filtersOrUpdater === 'function'
          ? filtersOrUpdater(current.filters)
          : filtersOrUpdater;
      store.set({ ...current, filters: newFilters });
    },
    []
  );

  const setLimit = useCallback((limit: number) => {
    store.set({ ...store.get(), limit });
  }, []);

  const setOrderBy = useCallback((orderBy: OrderCriteria[]) => {
    store.set({ ...store.get(), orderBy });
  }, []);

  const reset = useCallback(() => {
    store.set(defaultState);
  }, []);

  return {
    state,
    setFilters,
    setLimit,
    setOrderBy,
    reset,
  };
}
