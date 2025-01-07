import { Button, Checkbox, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute, Outlet, useNavigate, useParams } from '@tanstack/react-router';
import classNames from 'classnames';
import { useQueryClient, useSuspenseQuery, useQuery } from '@tanstack/react-query';
import {
	airtableSpaceQueryOptions,
	archiveQueueLengthQueryOptions,
	archiveSpaces,
	createIndexEntries,
} from './-queries';
import { AppLink } from '@/app/components/AppLink';
import { useState } from 'react';
import { Cross1Icon, Link1Icon } from '@radix-ui/react-icons';
import { Icon } from '@/app/components/Icon';

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
	const [selectedSpaces, setSelectedSpaces] = useState<Set<string>>(new Set());
	const [processing, setProcessing] = useState(false);
	const queryClient = useQueryClient();

	const handleBatchCreateEntries = async () => {
		setProcessing(true);
		try {
			await createIndexEntries({
				data: Array.from(selectedSpaces).map((id) => spaces.find((s) => s.id === id)!),
			});
			queryClient.invalidateQueries({
				queryKey: ['airtableSpaces'],
			});
			selectedSpaces.forEach((id) => {
				queryClient.invalidateQueries({
					queryKey: ['airtableSpaceById', id],
				});
			});
			setSelectedSpaces(new Set());
		} catch (error) {
			console.error('Error creating index entries:', error);
		} finally {
			setProcessing(false);
		}
	};

	const handleArchiveSelected = async () => {
		setProcessing(true);
		try {
			await archiveSpaces({ data: Array.from(selectedSpaces) });
			queryClient.invalidateQueries({
				queryKey: ['archiveQueueLength'],
			});
			queryClient.invalidateQueries({
				queryKey: ['airtableSpaces'],
			});
			selectedSpaces.forEach((id) => {
				queryClient.invalidateQueries({
					queryKey: ['airtableSpaceById', id],
				});
			});
			setSelectedSpaces(new Set());
		} catch (error) {
			console.error('Error archiving spaces:', error);
		} finally {
			setProcessing(false);
		}
	};

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
					<Text>{selectedSpaces.size} selected</Text>
					<menu className="flex flex-row gap-1 items-center">
						{selectedSpaces.size > 0 ? (
							<>
								<li>
									<Button
										size="1"
										variant="soft"
										disabled={processing}
										onClick={handleArchiveSelected}
									>
										Archive All
									</Button>
								</li>
								<li>
									<Button
										size="1"
										variant="soft"
										disabled={processing}
										onClick={handleBatchCreateEntries}
									>
										Create Entries
									</Button>
								</li>
								<li>
									<IconButton variant="soft" size="1" onClick={() => setSelectedSpaces(new Set())}>
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
										onClick={() => {
											setSelectedSpaces(
												new Set(spaces.filter((s) => s.indexEntry).map((s) => s.id))
											);
										}}
									>
										All Mapped
									</Button>
								</li>
								<li>
									<Button
										size="1"
										variant="soft"
										onClick={() => {
											setSelectedSpaces(
												new Set(spaces.filter((s) => !s.indexEntry).map((s) => s.id))
											);
										}}
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
								className={classNames(
									'flex flex-col p-2 border  rounded-2 cursor-pointer',
									space.id === airtableId
										? 'bg-selected hover:bg-selected-hovered border-border-selected'
										: 'hover:bg-hovered border-border-subtle'
								)}
								onClick={(e) => {
									navigate({
										to: '/queue/$airtableId',
										params: { airtableId: space.id },
									});
								}}
							>
								<div className="flex flex-row items-center gap-3">
									<Checkbox
										checked={selectedSpaces.has(space.id)}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedSpaces((prev) => {
												const next = new Set(prev);
												if (next.has(space.id)) {
													next.delete(space.id);
												} else {
													next.add(space.id);
												}
												return next;
											});
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
