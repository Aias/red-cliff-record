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

		// Runtime-relevant options use getters to always read the latest values from the ref.
		// Static metadata (description, category) is captured at registration time since
		// it's only used for display in the help menu.
		const config: KeyboardShortcutConfig = {
			id,
			keys,
			description: opts.description,
			callback: (event) => callbackRef.current(event),
			scope: opts.scope,
			when: () => optionsRef.current.when?.() ?? true,
			get allowInInput() {
				return optionsRef.current.allowInInput;
			},
			get preventDefault() {
				return optionsRef.current.preventDefault;
			},
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
