import { KeyboardIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatShortcut } from '@/lib/keyboard-shortcuts/parse';
import {
  useKeyboardShortcut,
  useRegisteredShortcuts,
} from '@/lib/keyboard-shortcuts/use-keyboard-shortcut';
import { css } from '@/styled-system/css';
import { styled } from '@/styled-system/jsx';
import type { SystemStyleObject } from '@/styled-system/types';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

interface ShortcutGroup {
  category: string;
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
}

/**
 * Dialog that displays all registered keyboard shortcuts grouped by category
 */
export function KeyboardShortcutsHelp({ buttonCss }: { buttonCss?: SystemStyleObject }) {
  const [open, setOpen] = useState(false);
  const shortcuts = useRegisteredShortcuts();

  // Register the shortcut to open the help dialog
  useKeyboardShortcut('mod+/', () => setOpen(true), {
    description: 'Show keyboard shortcuts',
    category: 'General',
  });

  // Group shortcuts by category and deduplicate
  const groups = useMemo(() => {
    const groupMap = new Map<string, Map<string, string>>();

    for (const shortcut of shortcuts) {
      const category = shortcut.category ?? 'General';
      if (!groupMap.has(category)) {
        groupMap.set(category, new Map());
      }
      const categoryMap = groupMap.get(category);
      // Later registrations overwrite earlier ones (they have higher priority)
      // but we want to show the first description for each key combo
      if (categoryMap && !categoryMap.has(shortcut.keys)) {
        categoryMap.set(shortcut.keys, shortcut.description);
      }
    }

    const result: ShortcutGroup[] = [];
    for (const [category, shortcutMap] of groupMap) {
      const categoryShortcuts: ShortcutGroup['shortcuts'] = [];
      for (const [keys, description] of shortcutMap) {
        categoryShortcuts.push({ keys, description });
      }
      result.push({ category, shortcuts: categoryShortcuts });
    }

    // Sort categories, putting "General" first
    return result.sort((a, b) => {
      if (a.category === 'General') return -1;
      if (b.category === 'General') return 1;
      return a.category.localeCompare(b.category);
    });
  }, [shortcuts]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" css={buttonCss}>
          <KeyboardIcon />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={css({
          maxHeight: '[85vh]',
          overflowY: 'auto',
        })}
      >
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Quick actions available throughout the application</DialogDescription>
        </DialogHeader>
        <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '4' }}>
          {groups.map((group) => (
            <section key={group.category}>
              <styled.h3
                css={{
                  marginBlockEnd: '2',
                  textStyle: 'sm',
                  fontWeight: 'medium',
                  color: 'secondary',
                }}
              >
                {group.category}
              </styled.h3>
              <styled.div css={{ display: 'flex', flexDirection: 'column', gap: '2' }}>
                {group.shortcuts.map((shortcut) => (
                  <styled.div
                    key={shortcut.keys}
                    css={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 'md',
                      border: 'divider',

                      paddingBlock: '2',
                      paddingInlineStart: '3',
                      paddingInlineEnd: '2',
                      textStyle: 'sm',
                    }}
                  >
                    <span>{shortcut.description}</span>
                    <styled.kbd
                      css={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5',
                        borderRadius: 'md',
                        border: 'border',
                        backgroundColor: 'splash',
                        paddingInline: '2',
                        paddingBlock: '0.5',
                        fontFamily: 'mono',
                        fontWeight: 'medium',
                        color: 'accent',
                        letterSpacing: '0.15ch',
                      }}
                    >
                      {formatShortcut(shortcut.keys)}
                    </styled.kbd>
                  </styled.div>
                ))}
              </styled.div>
            </section>
          ))}
          {groups.length === 0 && (
            <styled.p css={{ textAlign: 'center', textStyle: 'sm', color: 'muted' }}>
              No keyboard shortcuts registered
            </styled.p>
          )}
        </styled.div>
      </DialogContent>
    </Dialog>
  );
}
