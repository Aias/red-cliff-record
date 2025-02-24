import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '@/app/trpc';
import { IntegrationType, type MediaSelect, type RecordSelect } from '@/server/db/schema';
import {
	Avatar,
	Badge,
	Checkbox,
	IntegrationLogo,
	Placeholder,
	Select,
	SelectContent,
	SelectionActions,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Spinner,
	type AvatarProps,
} from '@/components';
import { useSelection } from '@/lib/hooks/useSelection';

const SearchSchema = z.object({
	source: IntegrationType.optional(),
});

export const Route = createFileRoute('/queue/records')({
	validateSearch: SearchSchema,
	loaderDeps: ({ search: { source } }) => ({ source }),
	loader: async ({ context: { trpc, queryClient }, deps }) => {
		await queryClient.ensureQueryData(trpc.records.getQueue.queryOptions(deps));
	},
	component: RouteComponent,
});

const selectOptions: { label: string; value: IntegrationType }[] = [
	{ label: 'Airtable', value: 'airtable' },
	{ label: 'Github', value: 'github' },
	{ label: 'Lightroom', value: 'lightroom' },
	{ label: 'Raindrop', value: 'raindrop' },
	{ label: 'Readwise', value: 'readwise' },
	{ label: 'Twitter', value: 'twitter' },
];

function RouteComponent() {
	const utils = trpc.useUtils();
	const { source } = Route.useSearch();
	const params = useParams({
		strict: false,
	});
	const navigate = Route.useNavigate();
	const [results] = trpc.records.getQueue.useSuspenseQuery({ source });
	const { data: queueCount } = trpc.records.getQueueCount.useQuery({ source });
	const { selectedIds, toggleSelection, clearSelection, selectAll } = useSelection(
		results.map((r) => ({ id: r.id.toString() }))
	);
	const { mutate: setCurationStatus } = trpc.records.setCurationStatus.useMutation({
		onSuccess: () => {
			utils.records.getQueue.invalidate({ source });
			utils.records.getQueueCount.invalidate({ source });
			utils.records.get.invalidate();
			utils.records.search.invalidate();
		},
	});
	const { mutate: setPrivacy } = trpc.records.setPrivacy.useMutation({
		onSuccess: () => {
			utils.records.getQueue.invalidate({ source });
			utils.records.getQueueCount.invalidate({ source });
			utils.records.get.invalidate();
		},
	});
	return (
		<div className="flex basis-full overflow-hidden">
			<div className="flex max-w-md grow-0 basis-full flex-col gap-1 overflow-hidden border-r border-rcr-divider">
				<div className="flex items-center gap-4 border-b border-rcr-divider px-3 py-2">
					<h1 className="h3 whitespace-nowrap">Records Queue</h1>
					<Select
						value={source ?? 'all'}
						onValueChange={(value) => {
							if (value === 'all') {
								navigate({ search: { source: undefined } });
							} else {
								navigate({ search: { source: value as IntegrationType } });
							}
						}}
					>
						<SelectTrigger className="flex-grow">
							<SelectValue placeholder="Filter by source..." />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							{selectOptions.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span className="text-sm">
						<Badge>{typeof queueCount === 'number' ? queueCount : <Spinner />}</Badge>
					</span>
				</div>
				<div className="grow-0 basis-full overflow-y-auto">
					<SelectionActions
						className="px-3 py-2"
						selectedCount={selectedIds.size}
						onClear={clearSelection}
						onSelectAll={selectAll}
						actions={[
							{
								label: 'Mark as Reviewed',
								onClick: () => {
									setCurationStatus({
										recordIds: Array.from(selectedIds).map(Number),
										needsCuration: false,
									});
								},
							},
							{
								label: 'Mark as Needs Curation',
								onClick: () => {
									setCurationStatus({
										recordIds: Array.from(selectedIds).map(Number),
										needsCuration: true,
									});
								},
							},
							{
								label: 'Mark as Private',
								onClick: () => {
									setPrivacy({
										recordIds: Array.from(selectedIds).map(Number),
										isPrivate: true,
									});
								},
							},
							{
								label: 'Mark as Public',
								onClick: () => {
									setPrivacy({
										recordIds: Array.from(selectedIds).map(Number),
										isPrivate: false,
									});
								},
							},
						]}
					/>
					{results.length === 0 ? (
						<Placeholder>No Entries in Queue</Placeholder>
					) : (
						<div className="flex flex-col overflow-hidden">
							{results.map((entry) => (
								<RecordQueueItem
									key={entry.id}
									entry={entry}
									selected={params.recordId === entry.id.toString()}
									checked={selectedIds.has(entry.id.toString())}
									onCheckToggle={() => {
										toggleSelection(entry.id.toString());
									}}
									onClick={() => {
										navigate({
											to: '/queue/records/$recordId',
											params: { recordId: entry.id.toString() },
										});
									}}
								/>
							))}
						</div>
					)}
				</div>
			</div>
			<Outlet />
		</div>
	);
}

type RecordQueueItemProps = {
	entry: RecordSelect & {
		creators: {
			creator: RecordSelect & {
				media: MediaSelect[];
			};
		}[];
		categories: {
			category: RecordSelect;
		}[];
		media: MediaSelect[];
		children: RecordSelect[];
	};
	selected: boolean;
	checked: boolean;
	onCheckToggle: () => void;
	onClick: () => void;
};

const NoCreatorAvatar = ({ ...props }: Partial<AvatarProps>) => (
	<Avatar
		className="border border-dashed border-rcr-edge opacity-50"
		themed={false}
		inline
		{...props}
		fallback="?"
	/>
);

const RecordQueueItem = ({
	entry,
	selected,
	onClick,
	checked,
	onCheckToggle,
}: RecordQueueItemProps) => {
	const firstCreator = entry.creators[0]?.creator;
	const firstMedia = entry.media[0];
	const childRecords = entry.children;

	return (
		<div
			className="flex selectable flex-col border-b border-rcr-divider px-3 py-2 text-sm"
			data-status={selected ? 'active' : undefined}
			onClick={onClick}
		>
			<div className="flex gap-3">
				<div className="flex grow flex-col gap-1 overflow-hidden">
					<div className="flex items-center gap-2.5 overflow-hidden">
						<Checkbox
							checked={checked}
							onClick={(e) => {
								e.stopPropagation();
							}}
							onCheckedChange={onCheckToggle}
						/>
						{firstCreator ? (
							<>
								<Avatar
									src={firstCreator.media[0]?.url ?? undefined}
									fallback={firstCreator.title.slice(0, 1)}
									inline
								/>
							</>
						) : (
							<NoCreatorAvatar />
						)}
						<span
							role="button"
							className="inline-block shrink grow-0 justify-start truncate font-medium overflow-ellipsis whitespace-nowrap"
						>
							{entry.title ?? firstCreator?.title ?? 'Untitled'}
						</span>
						{entry.sources &&
							entry.sources.length > 0 &&
							entry.sources.map((source) => (
								<IntegrationLogo key={source} integration={source} inline className="text-xs" />
							))}
					</div>
					<p className="line-clamp-1 text-xs">
						{entry.content ??
							entry.summary ??
							entry.notes ??
							`(Synced on ${entry.recordCreatedAt.toLocaleString()})`}
					</p>
				</div>
				{firstMedia && firstMedia.type === 'image' && (
					<div className="relative w-16 shrink-0 self-stretch overflow-hidden rounded bg-rcr-tint">
						<img
							src={firstMedia.url}
							alt=""
							className="absolute inset-0 h-full w-full object-cover"
						/>
					</div>
				)}
			</div>
			{childRecords && childRecords.length > 0 && (
				<ol className="flex flex-col gap-2 overflow-hidden">
					{childRecords.map((child) => (
						<li
							key={child.id}
							className="truncate py-1 pl-4 text-xs font-medium text-rcr-secondary"
						>
							— {child.title ?? child.content ?? child.summary ?? child.notes}
						</li>
					))}
				</ol>
			)}
		</div>
	);
};
