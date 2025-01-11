import { Suspense, useCallback, useMemo, useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '@/app/components/Placeholder';
import { useBatchOperation } from '@/app/lib/useBatchOperation';
import { useSelection } from '@/app/lib/useSelection';
import { DetailsPage } from './-components/DetailsPage';
import { QueueList } from './-components/QueueList';
import {
	airtableSpacesQueryOptions,
	archiveQueueLengthQueryOptions,
	createIndexEntries,
	setSpaceArchiveStatus,
} from './-queries';

export const Route = createFileRoute('/(index)/queue/airtable')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(airtableSpacesQueryOptions());
	},
	component: RouteComponent,
});

function RouteComponent() {
	const queryClient = useQueryClient();
	const { data: spaces } = useSuspenseQuery(airtableSpacesQueryOptions());
	const { data: archiveQueueLength } = useQuery(archiveQueueLengthQueryOptions());

	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(spaces);
	const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);

	const selectedSpace = useMemo(
		() => (selectedSpaceId ? spaces.find((space) => space.id === selectedSpaceId) : null),
		[selectedSpaceId, spaces]
	);

	const unselectSpace = useCallback(() => {
		setSelectedSpaceId(null);
	}, []);

	const createEntriesOperation = useBatchOperation({
		selectedIds,
		clearSelection,
		queryClient,
		invalidateKeys: [['index', 'airtable', 'spaces']],
		prepareData: (ids) => ids.map((id) => spaces.find((s) => s.id === id)!),
		operation: createIndexEntries,
	});

	const archiveOperation = useBatchOperation({
		selectedIds,
		clearSelection,
		queryClient,
		invalidateKeys: [['index', 'airtable']],
		prepareData: (ids) => ({ ids }),
		operation: setSpaceArchiveStatus,
	});

	return (
		<main className="flex basis-full gap-2 overflow-hidden p-3">
			<section className="flex min-w-xs shrink grow-0 flex-col gap-2">
				<header className="flex flex-row items-center justify-between gap-2">
					<Heading size="4">Index Queue</Heading>

					<Text size="3" color="gray">
						{archiveQueueLength ? `${archiveQueueLength} unarchived` : 'All archived'}
					</Text>
				</header>

				<div className="flex flex-row items-center justify-between gap-2">
					<Text>{selectedIds.size} selected</Text>
					<menu className="flex flex-row items-center gap-1">
						{selectedIds.size > 0 ? (
							<>
								<li>
									<Button
										size="1"
										variant="soft"
										disabled={archiveOperation.processing}
										onClick={archiveOperation.execute}
									>
										Archive All
									</Button>
								</li>
								<li>
									<Button
										size="1"
										variant="soft"
										disabled={createEntriesOperation.processing}
										onClick={createEntriesOperation.execute}
									>
										Create Entries
									</Button>
								</li>
								<li>
									<IconButton variant="soft" size="1" onClick={() => clearSelection()}>
										<Cross1Icon className="h-3 w-3" />
									</IconButton>
								</li>
							</>
						) : (
							<>
								<li>
									<Button
										size="1"
										variant="soft"
										onClick={() => selectAll((space) => Boolean(space.indexEntry))}
									>
										All Mapped
									</Button>
								</li>
								<li>
									<Button
										size="1"
										variant="soft"
										onClick={() => selectAll((space) => !space.indexEntry)}
									>
										All Unmapped
									</Button>
								</li>
							</>
						)}
					</menu>
				</div>
				<ScrollArea>
					<QueueList
						entries={spaces.map(({ id, name, description, archivedAt, indexEntry }) => ({
							id,
							name,
							description,
							archivedAt,
							indexEntry,
							selected: id === selectedSpaceId,
						}))}
						selectedIds={selectedIds}
						toggleSelection={toggleSelection}
						onEntryClick={setSelectedSpaceId}
					/>
				</ScrollArea>
			</section>
			{selectedSpace ? (
				<Suspense
					fallback={
						<Placeholder>
							<Text>Loading...</Text>
						</Placeholder>
					}
				>
					<DetailsPage space={selectedSpace} handleClose={unselectSpace} />
				</Suspense>
			) : (
				<Placeholder>
					<Text>Select an index entry to edit.</Text>
				</Placeholder>
			)}
		</main>
	);
}
