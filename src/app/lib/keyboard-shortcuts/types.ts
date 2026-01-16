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
 * Shortcut key string type.
 * Format: modifier keys joined with '+', followed by the main key.
 * Examples: "mod+k", "mod+shift+k", "escape", "mod+arrowup"
 *
 * Note: TypeScript cannot fully validate shortcut strings at compile time,
 * but this type provides documentation and could be extended with template
 * literal types for basic autocomplete support in the future.
 */
export type ShortcutKeys = string;

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
 * Base options shared by all shortcut registration methods.
 * These are the optional configuration properties that control shortcut behavior.
 */
export interface ShortcutOptions {
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
 * Configuration for a keyboard shortcut (used internally by the context)
 */
export interface KeyboardShortcutConfig extends ShortcutOptions {
	/** Unique identifier for this shortcut */
	id: string;
	/** Shortcut key combination (e.g., "mod+shift+k") */
	keys: ShortcutKeys;
	/** Human-readable description shown in help */
	description: string;
	/** Callback when shortcut is triggered */
	callback: (event: KeyboardEvent) => void;
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
export interface KeyboardShortcutProps extends ShortcutOptions {
	/** Shortcut key combination (e.g., "mod+shift+k") */
	keys: ShortcutKeys;
	/** Callback when shortcut is triggered */
	onActivate: (event: KeyboardEvent) => void;
	/** Human-readable description shown in help */
	description: string;
	/** Whether the shortcut is enabled (default: true) */
	enabled?: boolean;
}

/**
 * Options for the useKeyboardShortcut hook
 */
export interface UseKeyboardShortcutOptions extends ShortcutOptions {
	/** Human-readable description (required for help menu) */
	description: string;
	/** Whether the shortcut is enabled (default: true) */
	enabled?: boolean;
}
