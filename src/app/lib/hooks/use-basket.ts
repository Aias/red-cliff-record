import { useCallback, useSyncExternalStore } from 'react';
import type { DbId } from '@/shared/types/api';

const STORAGE_KEY = 'rcr:basket';

// In-memory cache for current value (shared across all hook instances)
let cachedIds: DbId[] = [];
let initialized = false;

// Set of listeners for useSyncExternalStore
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function parseStoredValue(raw: string | null): DbId[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is DbId => typeof v === 'number') : [];
  } catch {
    return [];
  }
}

function loadFromStorage(): DbId[] {
  if (typeof window === 'undefined') return [];
  return parseStoredValue(localStorage.getItem(STORAGE_KEY));
}

function saveToStorage(ids: DbId[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  cachedIds = ids;
  notifyListeners();
}

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  cachedIds = loadFromStorage();

  // Cross-tab sync
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cachedIds = parseStoredValue(e.newValue);
      notifyListeners();
    }
  });
}

function subscribe(callback: () => void) {
  initialize();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): DbId[] {
  initialize();
  return cachedIds;
}

function getServerSnapshot(): DbId[] {
  return [];
}

export function addToBasket(id: DbId) {
  const current = getSnapshot();
  if (current.includes(id)) return;
  saveToStorage([...current, id]);
}

export function removeFromBasket(id: DbId) {
  const current = getSnapshot();
  saveToStorage(current.filter((v) => v !== id));
}

export function clearBasket() {
  saveToStorage([]);
}

export function useBasket() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id: DbId) => addToBasket(id), []);
  const remove = useCallback((id: DbId) => removeFromBasket(id), []);
  const clear = useCallback(() => clearBasket(), []);
  const has = useCallback((id: DbId) => ids.includes(id), [ids]);

  return { ids, add, remove, clear, has, count: ids.length };
}
