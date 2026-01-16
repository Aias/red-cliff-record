import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts';
import type { ShortcutScope } from '@/lib/keyboard-shortcuts';

interface KeyboardShortcutProps {
	/** Shortcut key combination (e.g., "mod+shift+k") */
	keys: string;
	/** Callback when shortcut is triggered */
	onActivate: (event: KeyboardEvent) => void;
	/** Human-readable description shown in help */
	description: string;
	/** Scope where this shortcut is active (default: 'global') */
	scope?: ShortcutScope;
	/** Additional condition for when shortcut should trigger */
	when?: () => boolean;
	/** Allow trigger even when focus is in an input (default: false) */
	allowInInput?: boolean;
	/** Prevent default browser behavior (default: true) */
	preventDefault?: boolean;
	/** Category for grouping in help menu */
	category?: string;
	/** Whether the shortcut is enabled (default: true) */
	enabled?: boolean;
}

/**
 * Declarative component for registering keyboard shortcuts
 *
 * Renders nothing - purely for side effects. The shortcut is registered
 * when the component mounts and unregistered when it unmounts.
 *
 * @example
 * <KeyboardShortcut
 *   keys="mod+k"
 *   onActivate={() => setOpen(true)}
 *   description="Open command menu"
 * />
 *
 * @example
 * <KeyboardShortcut
 *   keys="mod+shift+enter"
 *   onActivate={handleCurate}
 *   description="Curate and next"
 *   scope="record-form"
 *   category="Records"
 * />
 */
export function KeyboardShortcut({
	keys,
	onActivate,
	description,
	scope,
	when,
	allowInInput,
	preventDefault,
	category,
	enabled,
}: KeyboardShortcutProps) {
	useKeyboardShortcut(keys, onActivate, {
		description,
		scope,
		when,
		allowInInput,
		preventDefault,
		category,
		enabled,
	});

	return null;
}
