import type { HTMLAttributes } from 'react';
import { Button, DropdownMenu, IconButton } from '@radix-ui/themes';
import { ClearIcon } from './icons';
import { cn } from '~/lib/utils';

interface SelectionActionsProps extends HTMLAttributes<HTMLDivElement> {
	selectedCount: number;
	onClear: () => void;
	onSelectAll: () => void;
	actions: Array<{
		label: string;
		onClick: () => void;
		disabled?: boolean;
	}>;
}

export function SelectionActions({
	selectedCount,
	onClear,
	onSelectAll,
	actions,
	className,
	...props
}: SelectionActionsProps) {
	const firstAction = actions[0];

	return (
		<div role="toolbar" className={cn('flex items-center gap-2', className)} {...props}>
			<span className="grow text-sm text-secondary">{selectedCount} selected</span>
			{selectedCount === 0 ? (
				<Button onClick={() => onSelectAll()} size="1" variant="soft">
					Select All
				</Button>
			) : (
				<>
					{actions.length === 1 && firstAction ? (
						<Button
							onClick={() => firstAction.onClick()}
							disabled={firstAction.disabled}
							size="1"
							variant="soft"
						>
							{firstAction.label}
						</Button>
					) : (
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								<Button size="1" variant="surface">
									Actions
									<DropdownMenu.TriggerIcon />
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content>
								{actions.map((action) => (
									<DropdownMenu.Item
										key={action.label}
										onClick={() => action.onClick()}
										disabled={action.disabled}
									>
										{action.label}
									</DropdownMenu.Item>
								))}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					)}
					<IconButton variant="soft" onClick={() => onClear()} size="1" title="Clear selection">
						<ClearIcon />
					</IconButton>
				</>
			)}
		</div>
	);
}
