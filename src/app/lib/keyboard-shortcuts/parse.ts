import type { ModifierKey, ParsedShortcut } from './types';

const MODIFIER_KEYS = new Set<ModifierKey>(['mod', 'ctrl', 'alt', 'shift', 'meta']);

/**
 * Check if a string is a valid modifier key
 */
function isModifierKey(key: string): key is ModifierKey {
  return MODIFIER_KEYS.has(key as ModifierKey);
}

/**
 * Detect if the current platform is Mac
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.platform.toLowerCase().includes('mac');
}

/**
 * Parse a shortcut string into its components
 *
 * @example
 * parseShortcut("mod+shift+k") // { modifiers: Set(['mod', 'shift']), key: 'k' }
 * parseShortcut("escape") // { modifiers: Set([]), key: 'escape' }
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.toLowerCase().split('+');
  const modifiers = new Set<ModifierKey>();
  let key = '';

  for (const part of parts) {
    if (isModifierKey(part)) {
      modifiers.add(part);
    } else {
      key = part;
    }
  }

  return { modifiers, key };
}

/**
 * Normalize a key from KeyboardEvent.key to our format
 */
function normalizeKey(eventKey: string): string {
  const key = eventKey.toLowerCase();

  // Map common key variations
  const keyMap: Record<string, string> = {
    ' ': 'space',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    backspace: 'backspace',
    delete: 'delete',
    enter: 'enter',
    return: 'enter',
    escape: 'escape',
    esc: 'escape',
    tab: 'tab',
  };

  return keyMap[key] ?? key;
}

/**
 * Check if a KeyboardEvent matches a parsed shortcut
 */
export function matchesShortcut(event: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const mac = isMac();

  // Check each required modifier
  for (const modifier of parsed.modifiers) {
    switch (modifier) {
      case 'mod':
        // mod = meta on Mac, ctrl on Windows/Linux
        if (mac ? !event.metaKey : !event.ctrlKey) return false;
        break;
      case 'ctrl':
        if (!event.ctrlKey) return false;
        break;
      case 'alt':
        if (!event.altKey) return false;
        break;
      case 'shift':
        if (!event.shiftKey) return false;
        break;
      case 'meta':
        if (!event.metaKey) return false;
        break;
    }
  }

  // Check that no extra modifiers are pressed (except for 'mod' which shares with ctrl/meta)
  const hasMod = parsed.modifiers.has('mod');
  const hasCtrl = parsed.modifiers.has('ctrl');
  const hasMeta = parsed.modifiers.has('meta');
  const hasAlt = parsed.modifiers.has('alt');
  const hasShift = parsed.modifiers.has('shift');

  // On Mac: mod means meta, so ctrl should be unpressed (unless explicitly required)
  // On Windows: mod means ctrl, so meta should be unpressed (unless explicitly required)
  if (mac) {
    if (event.ctrlKey && !hasCtrl) return false;
    if (event.metaKey && !hasMod && !hasMeta) return false;
  } else {
    if (event.metaKey && !hasMeta) return false;
    if (event.ctrlKey && !hasMod && !hasCtrl) return false;
  }

  if (event.altKey && !hasAlt) return false;
  if (event.shiftKey && !hasShift) return false;

  // Check the main key
  const normalizedEventKey = normalizeKey(event.key);
  return normalizedEventKey === parsed.key;
}

/**
 * Check if the event target is an input-like element
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Format a shortcut for display in UI
 * Uses platform-appropriate symbols
 */
export function formatShortcut(shortcut: string): string {
  const mac = isMac();
  const parts = shortcut.toLowerCase().split('+');
  const formatted: string[] = [];

  for (const part of parts) {
    switch (part) {
      case 'mod':
        formatted.push(mac ? '⌘' : 'Ctrl');
        break;
      case 'ctrl':
        formatted.push(mac ? '⌃' : 'Ctrl');
        break;
      case 'alt':
        formatted.push(mac ? '⌥' : 'Alt');
        break;
      case 'shift':
        formatted.push(mac ? '⇧' : 'Shift');
        break;
      case 'meta':
        formatted.push(mac ? '⌘' : 'Win');
        break;
      case 'arrowup':
        formatted.push('↑');
        break;
      case 'arrowdown':
        formatted.push('↓');
        break;
      case 'arrowleft':
        formatted.push('←');
        break;
      case 'arrowright':
        formatted.push('→');
        break;
      case 'enter':
        formatted.push(mac ? '↵' : 'Enter');
        break;
      case 'escape':
        formatted.push('Esc');
        break;
      case 'backspace':
        formatted.push(mac ? '⌫' : 'Backspace');
        break;
      case 'delete':
        formatted.push(mac ? '⌦' : 'Del');
        break;
      case 'space':
        formatted.push('Space');
        break;
      case 'tab':
        formatted.push(mac ? '⇥' : 'Tab');
        break;
      default:
        formatted.push(part.toUpperCase());
    }
  }

  return formatted.join(mac ? '' : '+');
}
