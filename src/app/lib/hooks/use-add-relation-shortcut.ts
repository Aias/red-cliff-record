import { useEffect } from 'react';

/**
 * Registers the Meta+Alt+`+` shortcut and triggers the provided callback
 * when pressed. Automatically cleans up the listener when the component
 * unmounts or the callback changes.
 */
export function useAddRelationShortcut(callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.metaKey &&
        event.altKey &&
        (event.key === '+' || event.code === 'Equal')
      ) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [callback]);
}
