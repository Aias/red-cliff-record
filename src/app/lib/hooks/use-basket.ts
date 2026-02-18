import { useCallback, useSyncExternalStore } from 'react';
import type { DbId } from '@/shared/types/api';
import { createLocalStorageStore } from '../create-local-storage-store';

const store = createLocalStorageStore<DbId[]>({
  key: 'rcr:basket',
  defaultValue: [],
  parse(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v): v is DbId => typeof v === 'number') : [];
    } catch {
      return [];
    }
  },
});

function setBasketIds(ids: DbId[]) {
  const current = store.get();
  if (current.length === ids.length && current.every((id, index) => id === ids[index])) return;
  store.set(ids);
}

export function addToBasket(id: DbId) {
  const current = store.get();
  if (current.includes(id)) return;
  setBasketIds([...current, id]);
}

export function removeFromBasket(id: DbId) {
  setBasketIds(store.get().filter((v) => v !== id));
}

export function removeManyFromBasket(idsToRemove: Iterable<DbId>) {
  const removalSet = new Set(idsToRemove);
  if (removalSet.size === 0) return;
  setBasketIds(store.get().filter((id) => !removalSet.has(id)));
}

export function replaceBasketId(sourceId: DbId, targetId: DbId) {
  const current = store.get();
  const deduped = new Set<DbId>();
  const next: DbId[] = [];

  for (const id of current) {
    const resolvedId = id === sourceId ? targetId : id;
    if (deduped.has(resolvedId)) continue;
    deduped.add(resolvedId);
    next.push(resolvedId);
  }

  setBasketIds(next);
}

export function clearBasket() {
  setBasketIds([]);
}

export function useInBasket(id: DbId) {
  // Returns a primitive boolean so React can bail out via Object.is
  // when this specific ID's membership hasn't changed.
  return useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().includes(id),
    () => false
  );
}

export function useBasket() {
  const ids = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const add = useCallback((id: DbId) => addToBasket(id), []);
  const remove = useCallback((id: DbId) => removeFromBasket(id), []);
  const clear = useCallback(() => clearBasket(), []);

  return { ids, add, remove, clear, count: ids.length };
}
