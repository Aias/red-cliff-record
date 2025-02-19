import type { HTMLAttributes } from 'react';
import { ClearIcon, ExpandIcon } from './icons';
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components';
import { cn } from '@/lib/utils';

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
			<span className="grow text-sm text-rcr-secondary">{selectedCount} selected</span>
			{selectedCount === 0 ? (
				<Button onClick={() => onSelectAll()} size="sm">
					Select All
				</Button>
			) : (
				<>
					{actions.length === 1 && firstAction ? (
						<Button
							onClick={() => firstAction.onClick()}
							disabled={firstAction.disabled}
							size="sm"
							variant="secondary"
						>
							{firstAction.label}
						</Button>
					) : (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="sm" variant="secondary">
									Actions
									<ExpandIcon />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								{actions.map((action) => (
									<DropdownMenuItem
										key={action.label}
										onClick={() => action.onClick()}
										disabled={action.disabled}
									>
										{action.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<Button variant="secondary" size="sm" onClick={() => onClear()} title="Clear selection">
						<ClearIcon />
					</Button>
				</>
			)}
		</div>
	);
}
