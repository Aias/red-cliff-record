/**
 * Keyboard shortcut system types
 *
 * Shortcut string format: "mod+shift+k", "escape", "mod+arrowup"
 * - mod: Command on Mac, Ctrl on Windows/Linux
 * - ctrl: Always Ctrl key
 * - alt: Alt/Option key
 * - shift: Shift key
 * - meta: Command key (Mac only)
 *
 * Key names are lowercase and match KeyboardEvent.key values
 */

export type ModifierKey = 'mod' | 'ctrl' | 'alt' | 'shift' | 'meta';

/**
 * Parsed representation of a keyboard shortcut
 */
export interface ParsedShortcut {
	/** Modifier keys required */
	modifiers: Set<ModifierKey>;
	/** The main key (lowercase) */
	key: string;
}

/**
 * Scope for keyboard shortcuts - allows different shortcuts in different contexts
 */
export type ShortcutScope =
	| 'global' // Always active
	| 'record-form' // Active when editing a record
	| 'record-list' // Active when viewing record list
	| 'dialog'; // Active when a dialog is open

/**
 * Configuration for a keyboard shortcut
 */
export interface KeyboardShortcutConfig {
	/** Unique identifier for this shortcut */
	id: string;
	/** Shortcut key combination (e.g., "mod+shift+k") */
	keys: string;
	/** Human-readable description shown in help */
	description: string;
	/** Callback when shortcut is triggered */
	callback: (event: KeyboardEvent) => void;
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
}

/**
 * Registered shortcut with internal metadata
 *
 * Priority ordering: Later registrations win over earlier ones.
 * This means shortcuts registered lower in the component tree (more specific)
 * take precedence over shortcuts registered higher up (more general).
 */
export interface RegisteredShortcut extends KeyboardShortcutConfig {
	/** Parsed shortcut for efficient matching */
	parsed: ParsedShortcut;
	/** Registration order - higher numbers = later registration = higher priority */
	priority: number;
}

/**
 * Context value for keyboard shortcuts
 */
export interface KeyboardShortcutContextValue {
	/** Register a shortcut, returns cleanup function */
	register: (config: KeyboardShortcutConfig) => () => void;
	/** All currently registered shortcuts */
	shortcuts: RegisteredShortcut[];
	/** Current active scope */
	activeScope: ShortcutScope;
	/** Set the active scope */
	setActiveScope: (scope: ShortcutScope) => void;
	/** Check if a shortcut is currently active */
	isShortcutActive: (id: string) => boolean;
}

/**
 * Props for the KeyboardShortcut component
 */
export interface KeyboardShortcutProps extends Omit<KeyboardShortcutConfig, 'callback'> {
	/** Callback when shortcut is triggered */
	onActivate: (event: KeyboardEvent) => void;
	/** Children are not rendered - component is purely for registration */
	children?: never;
}
