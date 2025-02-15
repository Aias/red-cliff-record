import {
	Avatar,
	Badge,
	Button,
	Heading,
	Select,
	Spinner,
	Text,
	type AvatarProps,
} from '@radix-ui/themes';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { z } from 'zod';
import { IntegrationAvatar } from '~/app/components/IntegrationAvatar';
import { Placeholder } from '~/app/components/Placeholder';
import { trpc } from '~/app/trpc';
import {
	IntegrationType,
	type IndicesSelect,
	type MediaSelect,
	type RecordSelect,
} from '~/server/db/schema';

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
	const { source } = Route.useSearch();
	const params = useParams({
		strict: false,
	});
	const navigate = Route.useNavigate();
	const [results] = trpc.records.getQueue.useSuspenseQuery({ source });
	const { data: queueCount } = trpc.records.getQueueCount.useQuery({ source });

	return (
		<div className="flex basis-full overflow-hidden">
			<div className="flex max-w-md grow-0 basis-full flex-col gap-1 overflow-hidden border-r border-divider">
				<div className="flex items-center gap-4 border-b border-divider px-3 py-2">
					<Heading as="h2" size="3">
						Records Queue
					</Heading>
					<Select.Root
						value={source ?? 'all'}
						onValueChange={(value) => {
							if (value === 'all') {
								navigate({ search: { source: undefined } });
							} else {
								navigate({ search: { source: value as IntegrationType } });
							}
						}}
					>
						<Select.Trigger className="flex-grow" />
						<Select.Content>
							<Select.Item value="all">All</Select.Item>
							{selectOptions.map((option) => (
								<Select.Item key={option.value} value={option.value}>
									{option.label}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Badge size="2" className="mr-3">
						{typeof queueCount === 'number' ? queueCount : <Spinner />}
					</Badge>
				</div>
				<div className="grow-0 basis-full overflow-y-auto">
					{results.length === 0 ? (
						<Placeholder>No Entries in Queue</Placeholder>
					) : (
						<div className="flex flex-col overflow-hidden">
							{results.map((entry) => (
								<RecordQueueItem
									key={entry.id}
									entry={entry}
									selected={params.recordId === entry.id.toString()}
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
		recordCreators: {
			creator: IndicesSelect;
		}[];
		recordCategories: {
			category: IndicesSelect;
		}[];
		recordMedia: {
			media: MediaSelect;
		}[];
		format: IndicesSelect | null;
		children: RecordSelect[];
	};
	selected: boolean;
	onClick: () => void;
};

const NoCreatorAvatar = ({ ...props }: Partial<AvatarProps>) => (
	<Avatar
		className="border border-dashed border-edge opacity-50"
		color="gray"
		{...props}
		fallback="?"
	/>
);

const RecordQueueItem = ({ entry, selected, onClick }: RecordQueueItemProps) => {
	const firstCreator = entry.recordCreators[0]?.creator;
	const firstMedia = entry.recordMedia[0]?.media;
	const childRecords = entry.children;

	return (
		<div
			className="flex selectable flex-col border-b border-divider px-3 py-2"
			data-status={selected ? 'active' : undefined}
			onClick={onClick}
		>
			<div className="flex gap-3">
				<div className="flex grow flex-col gap-1 overflow-hidden">
					<div className="flex items-center gap-2 overflow-hidden">
						{firstCreator ? (
							<Avatar
								size="1"
								src={firstCreator.canonicalMediaUrl ?? undefined}
								fallback={firstCreator.name.slice(0, 1)}
							/>
						) : (
							<NoCreatorAvatar size="1" />
						)}
						<Button
							variant="ghost"
							size="2"
							className="inline-block shrink grow-0 cursor-pointer justify-start truncate font-medium overflow-ellipsis whitespace-nowrap hover:bg-transparent"
						>
							{entry.title ?? firstCreator?.name ?? 'Untitled'}
						</Button>
						{entry.sources &&
							entry.sources.length > 0 &&
							entry.sources.map((source) => (
								<IntegrationAvatar
									key={source}
									integration={source}
									size="1"
									className="size-4 opacity-75"
								/>
							))}
					</div>
					<Text as="p" size="1" color="gray" className="line-clamp-1">
						{entry.content ??
							entry.summary ??
							entry.notes ??
							`(Synced on ${entry.recordCreatedAt.toLocaleString()})`}
					</Text>
				</div>
				{firstMedia && firstMedia.type === 'image' && (
					<div className="relative w-16 shrink-0 self-stretch overflow-hidden rounded bg-tint">
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
						<Text
							key={child.id}
							weight="medium"
							size="1"
							className="py-1 pl-4"
							wrap="nowrap"
							truncate
							asChild
						>
							<li>— {child.title ?? child.content ?? child.summary ?? child.notes}</li>
						</Text>
					))}
				</ol>
			)}
		</div>
	);
};
