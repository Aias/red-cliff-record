import { useKeyboardShortcut } from '@/lib/keyboard-shortcuts';
import type { KeyboardShortcutProps } from '@/lib/keyboard-shortcuts';

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
