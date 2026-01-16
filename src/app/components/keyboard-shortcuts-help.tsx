import { useMemo, useState } from 'react';
import { KeyboardIcon } from 'lucide-react';
import { formatShortcut, useKeyboardShortcut, useRegisteredShortcuts } from '@/lib/keyboard-shortcuts';
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
export function KeyboardShortcutsHelp() {
	const [open, setOpen] = useState(false);
	const shortcuts = useRegisteredShortcuts();

	// Register the shortcut to open the help dialog
	useKeyboardShortcut(
		'mod+/',
		() => setOpen(true),
		{
			description: 'Show keyboard shortcuts',
			category: 'General',
		}
	);

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
				<Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
					<KeyboardIcon />
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
					<DialogDescription>
						Quick actions available throughout the application
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-6 pt-4">
					{groups.map((group) => (
						<section key={group.category}>
							<h3 className="mb-3 text-sm font-medium text-c-secondary">
								{group.category}
							</h3>
							<div className="flex flex-col gap-2">
								{group.shortcuts.map((shortcut) => (
									<div
										key={shortcut.keys}
										className="flex items-center justify-between rounded-md border border-c-divider px-3 py-2"
									>
										<span className="text-sm">{shortcut.description}</span>
										<kbd className="inline-flex items-center gap-1 rounded border border-c-border bg-c-mist px-2 py-1 font-mono text-xs text-c-secondary">
											{formatShortcut(shortcut.keys)}
										</kbd>
									</div>
								))}
							</div>
						</section>
					))}
					{groups.length === 0 && (
						<p className="text-center text-sm text-c-hint">
							No keyboard shortcuts registered
						</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
