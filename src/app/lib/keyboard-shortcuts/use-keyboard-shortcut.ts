import { useContext, useLayoutEffect, useRef } from 'react';
import { KeyboardShortcutContext } from './context';
import type {
	KeyboardShortcutConfig,
	KeyboardShortcutContextValue,
	ShortcutKeys,
	UseKeyboardShortcutOptions,
} from './types';

/**
 * Get the keyboard shortcut context
 * Throws if used outside of KeyboardShortcutProvider
 */
export function useKeyboardShortcutContext(): KeyboardShortcutContextValue {
	const context = useContext(KeyboardShortcutContext);
	if (!context) {
		throw new Error('useKeyboardShortcutContext must be used within KeyboardShortcutProvider');
	}
	return context;
}

// Re-export for convenience
export type { UseKeyboardShortcutOptions } from './types';

/**
 * Hook to register a keyboard shortcut
 *
 * The shortcut is automatically registered when the component mounts
 * and unregistered when it unmounts. Shortcuts registered later
 * (lower in the component tree) take precedence over earlier ones.
 *
 * @example
 * // Simple shortcut
 * useKeyboardShortcut('mod+k', () => setOpen(true), {
 *   description: 'Open command menu'
 * });
 *
 * @example
 * // Shortcut with scope
 * useKeyboardShortcut('mod+shift+enter', handleCurate, {
 *   description: 'Curate and next',
 *   scope: 'record-form',
 *   category: 'Records'
 * });
 */
export function useKeyboardShortcut(
	keys: ShortcutKeys,
	callback: (event: KeyboardEvent) => void,
	options: UseKeyboardShortcutOptions
): void {
	const context = useContext(KeyboardShortcutContext);

	const { allowInInput, category, description, enabled, preventDefault, scope, when } = options;

	// Use refs to avoid re-registering on every render
	const callbackRef = useRef(callback);
	const contextRef = useRef(context);

	// Update refs on each render
	callbackRef.current = callback;
	contextRef.current = context;

	useLayoutEffect(() => {
		const ctx = contextRef.current;
		if (!ctx) return;

		// Don't register if disabled
		if (enabled === false) return;

		// Generate stable ID from keys + scope
		const id = `${scope ?? 'global'}:${keys}`;

		// Options are captured at registration time. Re-register when they change.
		const config: KeyboardShortcutConfig = {
			id,
			keys,
			description,
			callback: (event) => callbackRef.current(event),
			scope,
			when,
			allowInInput,
			preventDefault,
			category,
		};

		return ctx.register(config);
	}, [allowInInput, category, description, enabled, keys, preventDefault, scope, when]);
}

/**
 * Hook to get all registered shortcuts (useful for help dialogs)
 */
export function useRegisteredShortcuts() {
	const context = useContext(KeyboardShortcutContext);
	return context?.shortcuts ?? [];
}

/**
 * Hook to set the active shortcut scope
 */
export function useShortcutScope() {
	const context = useContext(KeyboardShortcutContext);

	return {
		activeScope: context?.activeScope ?? 'global',
		setActiveScope: context?.setActiveScope ?? (() => {}),
	};
}
