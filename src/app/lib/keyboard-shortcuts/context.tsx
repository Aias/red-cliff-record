import { createContext, useCallback, useRef, useSyncExternalStore } from 'react';
import { isInputElement, matchesShortcut, parseShortcut } from './parse';
import type {
	KeyboardShortcutConfig,
	KeyboardShortcutContextValue,
	RegisteredShortcut,
	ShortcutScope,
} from './types';

/**
 * Context for keyboard shortcuts
 */
export const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | null>(null);

/**
 * Internal store for managing shortcuts
 */
function createShortcutStore() {
	let shortcuts: RegisteredShortcut[] = [];
	let activeScope: ShortcutScope = 'global';
	let priorityCounter = 0;
	const listeners = new Set<() => void>();

	const notify = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		getShortcuts: () => shortcuts,
		getActiveScope: () => activeScope,

		setActiveScope: (scope: ShortcutScope) => {
			activeScope = scope;
			notify();
		},

		register: (config: KeyboardShortcutConfig): (() => void) => {
			const registered: RegisteredShortcut = {
				...config,
				parsed: parseShortcut(config.keys),
				priority: ++priorityCounter,
			};

			shortcuts = [...shortcuts, registered];
			notify();

			// Return cleanup function
			return () => {
				shortcuts = shortcuts.filter((s) => s !== registered);
				notify();
			};
		},

		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},

		getSnapshot: () => ({ shortcuts, activeScope }),
	};
}

interface KeyboardShortcutProviderProps {
	children: React.ReactNode;
}

/**
 * Provider component that enables keyboard shortcuts throughout the app
 *
 * Wraps the application and handles global keyboard event listening.
 * Shortcuts registered lower in the component tree take precedence
 * over shortcuts registered higher up.
 */
export function KeyboardShortcutProvider({ children }: KeyboardShortcutProviderProps) {
	const storeRef = useRef<ReturnType<typeof createShortcutStore>>(null);
	if (!storeRef.current) {
		storeRef.current = createShortcutStore();
	}
	const store = storeRef.current;

	const { shortcuts, activeScope } = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot
	);

	const setActiveScope = useCallback(
		(scope: ShortcutScope) => {
			store.setActiveScope(scope);
		},
		[store]
	);

	const register = useCallback(
		(config: KeyboardShortcutConfig) => {
			return store.register(config);
		},
		[store]
	);

	const isShortcutActive = useCallback(
		(id: string) => {
			return shortcuts.some((s) => s.id === id);
		},
		[shortcuts]
	);

	// Handle keyboard events
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			// Skip if no shortcuts registered
			if (shortcuts.length === 0) return;

			// Check if we're in an input element
			const inInput = isInputElement(event.target);

			// Find matching shortcuts, sorted by priority (highest first = most recently registered)
			const matching = [...shortcuts]
				.sort((a, b) => b.priority - a.priority)
				.filter((shortcut) => {
					// Check if shortcut matches key combination
					if (!matchesShortcut(event, shortcut.parsed)) return false;

					// Check scope
					const shortcutScope = shortcut.scope ?? 'global';
					if (shortcutScope !== 'global' && shortcutScope !== activeScope) return false;

					// Check input restriction
					if (inInput && !shortcut.allowInInput) return false;

					// Check custom condition
					if (shortcut.when && !shortcut.when()) return false;

					return true;
				});

			// Execute the highest priority matching shortcut
			const shortcut = matching[0];
			if (shortcut) {
				if (shortcut.preventDefault !== false) {
					event.preventDefault();
				}
				shortcut.callback(event);
			}
		},
		[shortcuts, activeScope]
	);

	// Set up global event listener
	const listenerRef = useRef<((event: KeyboardEvent) => void) | null>(null);

	// Update listener when handleKeyDown changes
	if (listenerRef.current !== handleKeyDown) {
		if (listenerRef.current) {
			document.removeEventListener('keydown', listenerRef.current);
		}
		document.addEventListener('keydown', handleKeyDown);
		listenerRef.current = handleKeyDown;
	}

	const contextValue: KeyboardShortcutContextValue = {
		register,
		shortcuts,
		activeScope,
		setActiveScope,
		isShortcutActive,
	};

	return (
		<KeyboardShortcutContext.Provider value={contextValue}>
			{children}
		</KeyboardShortcutContext.Provider>
	);
}
