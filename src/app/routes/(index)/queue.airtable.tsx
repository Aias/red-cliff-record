import { Suspense, useCallback, useMemo, useState } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { Placeholder } from '~/app/components/Placeholder';
import { toTitleCase } from '~/app/lib/formatting';
import { useSelection } from '~/app/lib/useSelection';
import { trpc } from '~/app/trpc';
import { DetailsPage } from './-components/DetailsPage';
import { QueueList } from './-components/QueueList';

export const Route = createFileRoute('/(index)/queue/airtable')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getSpaces.queryOptions({ limit: 100 }));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const [spaces] = trpc.airtable.getSpaces.useSuspenseQuery({ limit: 100 });
	const { data: archiveQueueLength } = trpc.airtable.getArchiveQueueLength.useQuery();

	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(spaces);
	const [inspectedSpaceId, setInspectedSpaceId] = useState<string | null>(null);

	const inspectedSpace = useMemo(
		() => (inspectedSpaceId ? spaces.find((space) => space.id === inspectedSpaceId) : null),
		[inspectedSpaceId, spaces]
	);

	const unselectSpace = useCallback(() => {
		setInspectedSpaceId(null);
	}, []);

	const createIndexMutation = trpc.indices.createIndexEntry.useMutation();
	const archiveSpacesMutation = trpc.airtable.setSpaceArchiveStatus.useMutation();
	const linkSpaceToIndexEntryMutation = trpc.airtable.linkSpaceToIndexEntry.useMutation();

	const handleBatchCreateIndices = useCallback(async () => {
		const selectedSpaces = spaces.filter((space) => selectedIds.has(space.id));
		await Promise.all(
			selectedSpaces.map((space) =>
				createIndexMutation
					.mutateAsync({
						name: toTitleCase(space.name),
						mainType: 'category',
						createdAt: space.createdAt ?? space.contentCreatedAt,
						updatedAt: space.updatedAt ?? space.contentUpdatedAt,
					})
					.then((newEntry) =>
						linkSpaceToIndexEntryMutation.mutateAsync({
							spaceId: space.id,
							indexEntryId: newEntry.id,
						})
					)
			)
		);
	}, [createIndexMutation, linkSpaceToIndexEntryMutation, selectedIds]);

	const handleBatchArchiveSpaces = useCallback(() => {
		archiveSpacesMutation.mutate({
			spaceIds: Array.from(selectedIds),
			shouldArchive: true,
		});
	}, [archiveSpacesMutation, selectedIds]);

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
										disabled={archiveSpacesMutation.isPending}
										onClick={handleBatchArchiveSpaces}
									>
										Archive All
									</Button>
								</li>
								<li>
									<Button
										size="1"
										variant="soft"
										disabled={createIndexMutation.isPending}
										onClick={handleBatchCreateIndices}
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
							selected: id === inspectedSpaceId,
						}))}
						selectedIds={selectedIds}
						toggleSelection={toggleSelection}
						onEntryClick={setInspectedSpaceId}
					/>
				</ScrollArea>
			</section>
			{inspectedSpace ? (
				<Suspense
					fallback={
						<Placeholder>
							<Text>Loading...</Text>
						</Placeholder>
					}
				>
					<DetailsPage space={inspectedSpace} handleClose={unselectSpace} />
				</Suspense>
			) : (
				<Placeholder>
					<Text>Select an index entry to edit.</Text>
				</Placeholder>
			)}
		</main>
	);
}
