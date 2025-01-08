import { Button, Checkbox, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery, useQuery } from '@tanstack/react-query';
import {
	airtableSpaceQueryOptions,
	archiveQueueLengthQueryOptions,
	archiveSpaces,
	createIndexEntries,
} from './-queries';
import { AppLink } from '@/app/components/AppLink';
import { Cross1Icon, Link1Icon } from '@radix-ui/react-icons';
import { Icon } from '@/app/components/Icon';
import { useSelection } from '@/app/lib/useSelection';
import { useBatchOperation } from '@/app/lib/useBatchOperation';

export const Route = createFileRoute('/(index)/queue')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(airtableSpaceQueryOptions());
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { data: spaces } = useSuspenseQuery(airtableSpaceQueryOptions());
	const { data: archiveQueueLength } = useQuery(archiveQueueLengthQueryOptions());
	const navigate = useNavigate();
	const { airtableId } = useParams({
		strict: false,
	});
	const { selectedIds, toggleSelection, selectAll, clearSelection } = useSelection(spaces);
	const queryClient = useQueryClient();

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
		prepareData: (ids) => ids,
		operation: archiveSpaces,
	});

	return (
		<main className="p-3 basis-full grow-0 h-full flex gap-2">
			<section className="flex flex-col gap-2 grow-0 shrink min-w-xs">
				<header className="flex flex-row gap-2 justify-between items-center">
					<Heading size="4">Index Queue</Heading>
					{archiveQueueLength && (
						<Text size="3" color="gray">
							{archiveQueueLength} remaining
						</Text>
					)}
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
					<ul className="flex flex-col gap-2">
						{spaces.map((space) => (
							<li
								key={space.id}
								className="flex flex-col p-2 border rounded-2 selectable"
								onClick={(e) => {
									navigate({
										to: '/queue/$airtableId',
										params: { airtableId: space.id },
									});
								}}
							>
								<div className="flex flex-row items-center gap-3">
									<Checkbox
										checked={selectedIds.has(space.id)}
										onClick={(e) => {
											e.stopPropagation();
											toggleSelection(space.id);
										}}
									/>
									<AppLink
										to={'/queue/$airtableId'}
										params={{ airtableId: space.id }}
										className="grow"
									>
										{space.name}
									</AppLink>
									{space.icon && <Text size="2">{space.icon}</Text>}
								</div>
								{space.fullName && (
									<Text color="gray" size="2">
										{space.fullName}
									</Text>
								)}
								{space.indexEntry && (
									<div className="flex flex-row gap-1 items-center border-t border-gray-a3 pt-2 mt-2">
										<Icon size="3" color="grass" className="mr-1">
											<Link1Icon />
										</Icon>
										<Text size="2" color="gray" className="capitalize">
											{space.indexEntry.mainType}:
										</Text>
										<Text size="2">{space.indexEntry.name}</Text>
									</div>
								)}
							</li>
						))}
					</ul>
				</ScrollArea>
			</section>
			<Outlet />
		</main>
	);
}
