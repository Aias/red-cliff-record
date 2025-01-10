import { Suspense, useState } from 'react';
import { Cross1Icon, LinkBreak2Icon } from '@radix-ui/react-icons';
import { Button, Card, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { MetadataList } from '@/app/components/MetadataList';
import { Placeholder } from '@/app/components/Placeholder';
import { invalidateQueries } from '@/app/lib/query-helpers';
import { useBatchOperation } from '@/app/lib/useBatchOperation';
import { useSelection } from '@/app/lib/useSelection';
import { IndexEntryForm } from './-components/IndexEntryForm';
import { NoEntryPlaceholder } from './-components/NoEntryPlaceholder';
import { QueueList } from './-components/QueueList';
import {
	airtableSpacesQueryOptions,
	archiveQueueLengthQueryOptions,
	createIndexEntries,
	setSpaceArchiveStatus,
	unlinkIndexEntries,
	type AirtableSpaceWithIndexEntry,
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
	const selectedSpace = selectedSpaceId
		? spaces.find((space) => space.id === selectedSpaceId)
		: null;

	const createEntriesOperation = useBatchOperation({
		selectedIds,
		clearSelection,
		queryClient,
		invalidateKeys: [
			['airtableSpaces'],
			...Array.from(selectedIds).map((id) => ['airtableSpaceById', id]),
		],
		prepareData: (ids) => ids.map((id) => spaces.find((s) => s.id === id)!),
		operation: createIndexEntries,
	});

	const archiveOperation = useBatchOperation({
		selectedIds,
		clearSelection,
		queryClient,
		invalidateKeys: [
			['archiveQueueLength'],
			['airtableSpaces'],
			...Array.from(selectedIds).map((id) => ['airtableSpaceById', id]),
		],
		prepareData: (ids) => ({ ids }),
		operation: setSpaceArchiveStatus,
	});

	return (
		<main className="p-3 basis-full overflow-hidden flex gap-2">
			<section className="flex flex-col gap-2 grow-0 shrink min-w-xs">
				<header className="flex flex-row gap-2 justify-between items-center">
					<Heading size="4">Index Queue</Heading>

					<Text size="3" color="gray">
						{archiveQueueLength ? `${archiveQueueLength} unarchived` : 'All archived'}
					</Text>
				</header>

				<div className="flex flex-row gap-2 justify-between items-center">
					<Text>{selectedIds.size} selected</Text>
					<menu className="flex flex-row gap-1 items-center">
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
										<Cross1Icon className="w-3 h-3" />
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
					<DetailsPage space={selectedSpace} handleClose={() => setSelectedSpaceId(null)} />
				</Suspense>
			) : (
				<Placeholder>
					<Text>Select an index entry to edit.</Text>
				</Placeholder>
			)}
		</main>
	);
}

const DetailsPage = ({
	space,
	handleClose,
}: {
	space: AirtableSpaceWithIndexEntry;
	handleClose: () => void;
}) => {
	const queryClient = useQueryClient();

	return (
		<Card className="flex gap-2 shrink basis-full">
			<section className="flex flex-col w-sm gap-4">
				<header className="flex justify-between items-center">
					<Heading size="4">Selected Space</Heading>
					{space.indexEntryId && (
						<IconButton
							size="1"
							variant="soft"
							color="red"
							onClick={() => {
								unlinkIndexEntries({ data: [space.id] }).then(() => {
									invalidateQueries(queryClient, [
										['airtableSpaceById', space.id],
										['airtableSpaces'],
									]);
								});
							}}
						>
							<LinkBreak2Icon className="w-4 h-4" />
						</IconButton>
					)}
				</header>
				{!space ? <Text>Not Found.</Text> : <MetadataList metadata={space} />}
				<Button
					variant="soft"
					onClick={() =>
						setSpaceArchiveStatus({
							data: { ids: [space.id], shouldArchive: !space.archivedAt },
						}).then(() => {
							invalidateQueries(queryClient, [
								['archiveQueueLength'],
								['airtableSpaceById', space.id],
								['airtableSpaces'],
							]);
						})
					}
				>
					{space.archivedAt ? 'Unarchive' : 'Archive'}
				</Button>
			</section>
			<section className="flex flex-col gap-4 grow pl-3 ml-3 border-l border-divider">
				<div className="flex justify-between items-center">
					<Heading size="4">Index Entry</Heading>
					<IconButton size="1" variant="soft" onClick={handleClose}>
						<Cross1Icon />
					</IconButton>
				</div>
				{space.indexEntry ? (
					<IndexEntryForm indexEntry={space.indexEntry} space={space} />
				) : (
					<NoEntryPlaceholder space={space} />
				)}
			</section>
		</Card>
	);
};
