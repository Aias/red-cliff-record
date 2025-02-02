import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import {
	Button,
	DropdownMenu,
	Heading,
	IconButton,
	ScrollArea,
	Spinner,
	Text,
} from '@radix-ui/themes';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { IconWrapper } from '~/app/components/IconWrapper';
import { MetadataList } from '~/app/components/MetadataList';
import { Placeholder } from '~/app/components/Placeholder';
import { useSelection } from '~/app/lib/useSelection';
import { MappingHandler } from './MappingHandler';
import { QueueListItem } from './QueueListItem';
import type { QueueActions, QueueConfig } from './types';

interface QueueLayoutProps<TInput, TOutput> extends QueueActions<TInput, TOutput> {
	config: QueueConfig<TInput, TOutput>;
	items: TInput[];
	children?: (inspectedId: string, defaults: Partial<TOutput>) => React.ReactNode;
}

export const QueueLayout = <TInput extends Record<string, unknown>, TOutput>({
	config,
	items,
	children = (_inspectedId, _defaults) => <div>No content defined.</div>,
	handleSearch,
	handleCreate,
	handleLink,
	handleUnlink,
	handleArchive,
	handleUnarchive,
	handleDeleteOutput,
}: QueueLayoutProps<TInput, TOutput>) => {
	const navigate = useNavigate();
	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(
		items.map((item) => ({ id: config.getInputId(item) }))
	);
	const { itemId: inspectedItemId } = useSearch({ from: '/queue' });
	const allIds = useMemo(() => new Set(items.map((item) => config.getInputId(item))), [items]);

	const navigateToItem = useCallback(
		(itemId: string) => {
			navigate({ to: '.', search: { itemId } });
		},
		[navigate]
	);

	const getAdjacentItemId = useCallback(
		(direction: 'prev' | 'next') => {
			const currentIndex = items.findIndex((item) => config.getInputId(item) === inspectedItemId);
			if (currentIndex === -1) return null;

			const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
			if (targetIndex < 0 || targetIndex >= items.length) return null;

			// We know this is safe because we checked the bounds
			const targetItem = items[targetIndex]!;
			return config.getInputId(targetItem);
		},
		[items, inspectedItemId, config]
	);

	// Add keyboard event handling
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ignore if focus is in an input or contenteditable element
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target instanceof HTMLElement && e.target.isContentEditable)
			) {
				return;
			}

			switch (e.key) {
				case 'ArrowDown': {
					e.preventDefault();
					const nextId = getAdjacentItemId('next');
					if (nextId) navigateToItem(nextId);
					break;
				}
				case 'ArrowUp': {
					e.preventDefault();
					const prevId = getAdjacentItemId('prev');
					if (prevId) navigateToItem(prevId);
					break;
				}
				case ' ': {
					e.preventDefault();
					if (inspectedItemId) {
						toggleSelection(inspectedItemId);
					}
					break;
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [inspectedItemId, items, navigate, toggleSelection]); // Added missing dependencies

	const inspectedItem = useMemo(() => {
		if (!inspectedItemId) return undefined;
		const item = items.find((item) => config.getInputId(item) === inspectedItemId);
		return item || undefined;
	}, [items, inspectedItemId, config]);

	const inspectedQueueItem = useMemo(() => {
		if (!inspectedItem) return undefined;
		return config.mapToQueueItem(inspectedItem);
	}, [inspectedItem]);

	const handleArchiveAndNavigate = useCallback(
		(ids: string[]) => {
			// If we're inspecting an item that's being archived, get its current index
			const currentIndex = inspectedItemId
				? items.findIndex((item) => config.getInputId(item) === inspectedItemId)
				: -1;

			// Perform the archive
			handleArchive(ids);

			// If we were inspecting an item, navigate to the new item at the same index
			if (currentIndex !== -1) {
				// Small delay to allow for state updates
				setTimeout(() => {
					const newItems = items.filter((item) => !ids.includes(config.getInputId(item)));
					const newItem = newItems[currentIndex] || newItems[newItems.length - 1];
					if (newItem) {
						navigateToItem(config.getInputId(newItem));
					}
				}, 0);
			}
		},
		[items, inspectedItemId, handleArchive, navigateToItem, config]
	);

	return (
		<main className="flex grow overflow-hidden">
			<div className="flex shrink-0 grow-0 basis-xs flex-col gap-4 border-r border-divider py-4">
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
													const queueData = config.mapToQueueItem(selectedItem);
													if (queueData.mappedId) {
														console.log(`Already mapped, skipping ${queueData.title}`);
														return;
													}

													const newEntry = await handleCreate(selectedItem);
													if (newEntry) {
														console.log('New entry created:', newEntry);
														console.log('Linking', id, 'to', config.getOutputId(newEntry));
														handleLink(id, config.getOutputId(newEntry));
													} else {
														console.log('No new entry created.');
													}
												});
											}}
										>
											Create Entries
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
												handleArchiveAndNavigate(Array.from(selectedIds));
												clearSelection();
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
							<>
								<Button size="1" variant="soft" onClick={() => selectAll()}>
									Select All
								</Button>
								<Button
									size="1"
									variant="soft"
									onClick={() => {
										const unmappedIds = items
											.filter((item) => !config.mapToQueueItem(item).mappedId)
											.map((item) => config.getInputId(item));
										clearSelection();
										toggleSelection(unmappedIds);
									}}
								>
									Select Unmapped
								</Button>
							</>
						)}
					</div>
				</header>
				<Suspense
					fallback={
						<Placeholder>
							<Spinner />
						</Placeholder>
					}
				>
					<ScrollArea scrollbars="vertical">
						<ol className="flex flex-col gap-1 px-3">
							{items.map((item) => {
								const itemId = config.getInputId(item);
								const queueItem = config.mapToQueueItem(item);
								return (
									<li key={itemId}>
										<QueueListItem
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
				</Suspense>
			</div>
			<div className="flex grow overflow-hidden p-3">
				<Suspense
					fallback={
						<Placeholder>
							<Spinner />
						</Placeholder>
					}
				>
					{inspectedItem ? (
						<div className="flex grow gap-3">
							<div className="flex shrink-1 grow-0 basis-1/2 flex-col gap-4">
								<header className="flex flex-col gap-2">
									<Heading size="3" as="h2">
										{config.getInputTitle(inspectedItem)}
									</Heading>
									<div role="toolbar" className="flex items-center gap-2">
										<Button
											size="1"
											variant="soft"
											className="flex-1"
											onClick={() => {
												const id = config.getInputId(inspectedItem);
												if (inspectedQueueItem?.archivedAt) {
													handleUnarchive([id]);
												} else {
													handleArchiveAndNavigate([id]);
												}
											}}
										>
											{inspectedQueueItem?.archivedAt ? 'Unarchive' : 'Archive'}
										</Button>
										<Button
											size="1"
											variant="soft"
											className="flex-1"
											disabled={!inspectedQueueItem?.mappedId}
											onClick={() => {
												const id = config.getInputId(inspectedItem);
												handleUnlink([id]);
											}}
										>
											Unlink
										</Button>
										{handleDeleteOutput && inspectedQueueItem?.mappedId && (
											<Button
												size="1"
												variant="soft"
												color="red"
												className="flex-1"
												onClick={() => {
													if (typeof inspectedQueueItem.mappedId === 'string') {
														handleDeleteOutput(inspectedQueueItem.mappedId);
													}
												}}
											>
												Delete Entry
											</Button>
										)}
									</div>
								</header>
								<ScrollArea scrollbars="vertical">
									<MetadataList metadata={inspectedItem} className="gap-3" />
									{inspectedQueueItem?.avatarUrl && (
										<img
											src={inspectedQueueItem.avatarUrl}
											alt={inspectedQueueItem.title}
											className="mt-4 w-full overflow-hidden rounded-md"
										/>
									)}
								</ScrollArea>
							</div>
							<div className="flex shrink-1 grow-0 basis-1/2 flex-col gap-3">
								{inspectedQueueItem?.mappedId ? (
									children(inspectedQueueItem.mappedId, config.getOutputDefaults(inspectedItem))
								) : inspectedQueueItem ? (
									<MappingHandler
										config={config}
										inspectedItem={inspectedItem}
										inspectedQueueItem={inspectedQueueItem}
										handleSearch={handleSearch}
										handleCreate={handleCreate}
										handleLink={handleLink}
									/>
								) : undefined}
							</div>
						</div>
					) : (
						<Placeholder>
							<Text size="3" color="gray">
								Select an item to map.
							</Text>
						</Placeholder>
					)}
				</Suspense>
			</div>
		</main>
	);
};
