import { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, DropdownMenu, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { IconWrapper } from '~/app/components/IconWrapper';
import { Placeholder } from '~/app/components/Placeholder';
import { useSelection } from '~/app/lib/useSelection';
import { QueueItemInspector } from './QueueItemInspector';
import { QueueItem } from './QueueListItem';
import type { QueueConfig } from './types';

interface QueueLayoutProps<TInput, TOutput> {
	config: QueueConfig<TInput, TOutput>;
	items: TInput[];
	handleSearch?: (query: string) => Promise<TOutput[] | void>;
	handleCreate?: (input: TInput) => Promise<TOutput | void>;
	handleLink?: (inputId: string, outputId: string) => Promise<TInput | void>;
	handleUnlink?: (inputIds: string[]) => Promise<TInput[] | void>;
	handleArchive?: (inputIds: string[]) => Promise<TInput[] | void>;
	handleUnarchive?: (inputIds: string[]) => Promise<TInput[] | void>;
}

export const QueueLayout = <TInput, TOutput>({
	config,
	items,
	handleSearch = async (_query) => {},
	handleCreate = async (_defaults) => {},
	handleLink = async (_inputId, _outputId) => {},
	handleUnlink = async (_inputIds) => {},
	handleArchive = async (_inputIds) => {},
	handleUnarchive = async (_inputIds) => {},
}: QueueLayoutProps<TInput, TOutput>) => {
	const navigate = useNavigate();
	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(
		items.map((item) => ({ id: config.getInputId(item) }))
	);
	const { itemId: inspectedItemId } = useSearch({ from: '/queue' });
	const allIds = useMemo(() => new Set(items.map((item) => config.getInputId(item))), [items]);

	const inspectedItem = useMemo(() => {
		if (!inspectedItemId) return undefined;
		return items.find((item) => config.getInputId(item) === inspectedItemId);
	}, [items, inspectedItemId]);

	return (
		<main className="flex grow overflow-hidden">
			<div className="flex max-w-xs flex-col gap-4 border-r border-divider py-4">
				<header className="flex flex-col gap-2 px-3">
					<Heading size="3" as="h2">
						{config.name}
					</Heading>
					<div role="toolbar" className="flex items-center gap-2">
						<Text size="3" color="gray" className="flex-1">
							{selectedIds.size > 0 ? `${selectedIds.size} selected` : `${items.length} items`}
						</Text>
						{selectedIds.size > 0 ? (
							<>
								<DropdownMenu.Root>
									<DropdownMenu.Trigger>
										<Button variant="surface" size="1">
											Bulk Actions
											<DropdownMenu.TriggerIcon />
										</Button>
									</DropdownMenu.Trigger>
									<DropdownMenu.Content>
										<DropdownMenu.Item
											onClick={() => {
												selectedIds.forEach(async (id) => {
													const selectedItem = items.find((item) => config.getInputId(item) === id);
													if (!selectedItem) return;
													console.log('Searching for', config.lookup(selectedItem));
													const search = await handleSearch(config.lookup(selectedItem));
													if (search && search.length > 0 && search[0]) {
														console.log(
															'Mapping found, linking',
															id,
															'to',
															config.getOutputId(search[0])
														);
														handleLink(id, config.getOutputId(search[0]));
													} else {
														console.log('No mapping found, creating new entry.');
														const newEntry = await handleCreate(selectedItem);
														if (newEntry) {
															console.log('New entry created:', newEntry);
															console.log('Linking', id, 'to', config.getOutputId(newEntry));
															handleLink(id, config.getOutputId(newEntry));
														} else {
															console.log('No new entry created.');
														}
													}
												});
											}}
										>
											Link or Create Entries
										</DropdownMenu.Item>
										<DropdownMenu.Item
											onClick={() => {
												console.log('Unlinking', Array.from(selectedIds));
												handleUnlink(Array.from(selectedIds));
											}}
										>
											Unlink Selected
										</DropdownMenu.Item>
										<DropdownMenu.Separator />
										<DropdownMenu.Item
											onClick={() => {
												console.log('Archiving', Array.from(selectedIds));
												handleArchive(Array.from(selectedIds));
											}}
										>
											Archive Selected
										</DropdownMenu.Item>
										<DropdownMenu.Item
											onClick={() => {
												console.log('Unarchiving', Array.from(selectedIds));
												handleUnarchive(Array.from(selectedIds));
											}}
										>
											Unarchive Selected
										</DropdownMenu.Item>
										<DropdownMenu.Separator />
										<DropdownMenu.Item
											onClick={() => {
												console.log('Inverting selection');
												toggleSelection(Array.from(allIds));
											}}
										>
											Invert Selection
										</DropdownMenu.Item>
									</DropdownMenu.Content>
								</DropdownMenu.Root>
								<IconButton size="1" variant="soft" onClick={() => clearSelection()}>
									<IconWrapper>
										<Cross1Icon />
									</IconWrapper>
								</IconButton>
							</>
						) : (
							<Button size="1" variant="soft" onClick={() => selectAll()}>
								Select All
							</Button>
						)}
					</div>
				</header>
				<ScrollArea scrollbars="vertical">
					<ol className="flex flex-col gap-1 px-3">
						{items.map((item) => {
							const itemId = config.getInputId(item);
							const queueItem = config.mapToQueueItem(item);
							return (
								<li key={itemId}>
									<QueueItem
										{...queueItem}
										className="selectable card"
										handleClick={() => navigate({ to: '.', search: { itemId } })}
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
