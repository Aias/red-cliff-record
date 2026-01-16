import { useContext, useLayoutEffect, useRef } from 'react';
import { KeyboardShortcutContext } from './context';
import type { KeyboardShortcutConfig, KeyboardShortcutContextValue, ShortcutScope } from './types';

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

/**
 * Options for useKeyboardShortcut hook
 */
export interface UseKeyboardShortcutOptions {
	/** Human-readable description (required for help menu) */
	description: string;
	/** Scope where this shortcut is active */
	scope?: ShortcutScope;
	/** Additional condition for when shortcut should trigger */
	when?: () => boolean;
	/** Allow trigger even when focus is in an input */
	allowInInput?: boolean;
	/** Prevent default browser behavior */
	preventDefault?: boolean;
	/** Category for grouping in help menu */
	category?: string;
	/** Whether the shortcut is enabled (default: true) */
	enabled?: boolean;
}

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
	keys: string,
	callback: (event: KeyboardEvent) => void,
	options: UseKeyboardShortcutOptions
): void {
	const context = useContext(KeyboardShortcutContext);

	// Use refs to avoid re-registering on every render
	const callbackRef = useRef(callback);
	const optionsRef = useRef(options);

	// Update refs on each render
	callbackRef.current = callback;
	optionsRef.current = options;

	useLayoutEffect(() => {
		if (!context) return;

		const opts = optionsRef.current;

		// Don't register if disabled
		if (opts.enabled === false) return;

		// Generate stable ID from keys + scope
		const id = `${opts.scope ?? 'global'}:${keys}`;

		const config: KeyboardShortcutConfig = {
			id,
			keys,
			description: opts.description,
			callback: (event) => callbackRef.current(event),
			scope: opts.scope,
			when: opts.when,
			allowInInput: opts.allowInInput,
			preventDefault: opts.preventDefault,
			category: opts.category,
		};

		return context.register(config);
	}, [context, keys, options.enabled, options.scope]);
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
