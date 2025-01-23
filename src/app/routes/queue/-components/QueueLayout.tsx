import { useMemo } from 'react';
import { Heading, ScrollArea, Text } from '@radix-ui/themes';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Placeholder } from '~/app/components/Placeholder';
import { useSelection } from '~/app/lib/useSelection';
import { QueueItemInspector } from './QueueItemInspector';
import { QueueItem } from './QueueListItem';
import type { QueueConfig } from './types';

interface QueueLayoutProps<TInput, TOutput> {
	config: QueueConfig<TInput, TOutput>;
	items: TInput[];
	// handleSearch: (query: string) => Promise<TOutput[]>;
	// handleLink: (inputId: string, outputId: number) => Promise<void>;
	// handleUnlink: (inputIds: string[]) => Promise<void>;
	// handleArchive: (inputIds: string[]) => Promise<void>;
	// handleUnarchive: (inputIds: string[]) => Promise<void>;
}

export const QueueLayout = <TInput, TOutput>({
	config,
	items,
	// handleSearch,
	// handleLink,
	// handleUnlink,
	// handleArchive,
	// handleUnarchive,
}: QueueLayoutProps<TInput, TOutput>) => {
	const navigate = useNavigate();
	const { selectedIds, toggleSelection } = useSelection(
		items.map((item) => ({ id: config.getItemId(item) }))
	);
	const { itemId: inspectedItemId } = useSearch({ from: '/queue' });

	const inspectedItem = useMemo(() => {
		if (!inspectedItemId) return undefined;
		return items.find((item) => config.getItemId(item) === inspectedItemId);
	}, [items, inspectedItemId]);

	return (
		<main className="flex grow overflow-hidden">
			<div className="flex max-w-xs flex-col gap-4 border-r border-divider py-4">
				<header className="flex flex-col gap-2 px-3">
					<Heading size="3" as="h2">
						{config.name}
					</Heading>
					<Text size="3" color="gray">
						{items.length} items
					</Text>
				</header>
				<ScrollArea scrollbars="vertical">
					<ol className="flex flex-col gap-1 px-3">
						{items.map((item) => {
							const itemId = config.getItemId(item);
							const queueItem = config.mapToQueueItem(item);
							return (
								<li
									key={itemId}
									className="selectable card"
									onClick={() => navigate({ to: '.', search: { itemId } })}
								>
									<QueueItem
										{...queueItem}
										selected={selectedIds.has(itemId)}
										active={inspectedItemId === itemId}
										handleSelect={() => toggleSelection(itemId)}
									/>
								</li>
							);
						})}
					</ol>
				</ScrollArea>
			</div>
			<div className="flex grow overflow-hidden p-3">
				{inspectedItem ? (
					<QueueItemInspector item={inspectedItem} lookup={config.lookup} />
				) : (
					<Placeholder>
						<Text size="3" color="gray">
							Select an item to map.
						</Text>
					</Placeholder>
				)}
			</div>
		</main>
	);
};
