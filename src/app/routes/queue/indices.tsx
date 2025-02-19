import { TabNav } from '@radix-ui/themes';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { z } from 'zod';
import { trpc } from '~/app/trpc';
import { IndexMainType, type IndicesSelect } from '~/server/db/schema';
import {
	Badge,
	CategoryIcon,
	EntityIcon,
	FormatIcon,
	Placeholder,
	Spinner,
	TabNavLink,
	UnknownIcon,
	type IconProps,
} from '~/components';
import { toTitleCase } from '~/lib/formatting';

const SearchSchema = z.object({
	type: IndexMainType.optional(),
});

export const Route = createFileRoute('/queue/indices')({
	validateSearch: SearchSchema,
	loaderDeps: ({ search: { type } }) => ({ type }),
	loader: async ({ context: { trpc, queryClient }, deps }) => {
		await queryClient.ensureQueryData(trpc.indices.getQueue.queryOptions(deps));
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { type } = Route.useSearch();
	const navigate = Route.useNavigate();
	const params = useParams({
		strict: false,
	});
	const [results] = trpc.indices.getQueue.useSuspenseQuery({ type });
	const { data: queueCount } = trpc.indices.getQueueCount.useQuery({ type });

	return (
		<div className="flex basis-full overflow-hidden">
			<div className="flex max-w-sm grow-0 basis-full flex-col gap-1 overflow-hidden border-r border-divider">
				<div className="flex items-center justify-between border-b border-divider text-sm">
					<TabNav.Root className="border-none shadow-none">
						<TabNavLink to="/queue/indices" search={{ type: undefined }} active={!type}>
							All
						</TabNavLink>
						{IndexMainType.options.map((indexType) => (
							<TabNavLink
								key={indexType}
								to="/queue/indices"
								search={{ type: indexType }}
								active={type === indexType}
							>
								{toTitleCase(indexType)}
							</TabNavLink>
						))}
					</TabNav.Root>
					<Badge className="mr-3">
						{typeof queueCount === 'number' ? queueCount : <Spinner />}
					</Badge>
				</div>

				<div className="grow-0 basis-full overflow-y-auto p-2">
					{results.length === 0 ? (
						<Placeholder>No Entries in Queue</Placeholder>
					) : (
						<div className="flex flex-col gap-2 overflow-hidden">
							{results.map((entry) => (
								<IndexEntryCard
									key={entry.id}
									entry={entry}
									onClick={() =>
										navigate({
											to: '/queue/indices/$indexEntryId',
											params: { indexEntryId: entry.id.toString() },
											search: { type },
										})
									}
									selected={params.indexEntryId === entry.id.toString()}
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

type IndexEntryCardProps = {
	entry: Omit<IndicesSelect, 'textEmbedding'>;
	onClick: () => void;
	selected: boolean;
};

const IndexEntryCard = ({ entry, onClick, selected }: IndexEntryCardProps) => {
	const extras = [];
	if (entry.subType) {
		extras.push(
			<span key="subtype" className="truncate text-xs">
				{toTitleCase(entry.subType)}
			</span>
		);
	}
	if (entry.shortName) {
		extras.push(
			<span key="short-name" className="truncate text-xs">
				{entry.shortName}
			</span>
		);
	}
	if (entry.canonicalUrl) {
		extras.push(
			<a
				key="canonical-url"
				href={entry.canonicalUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="truncate text-xs"
			>
				{new URL(entry.canonicalUrl).hostname}
			</a>
		);
	}

	return (
		<div
			className="flex selectable gap-2 rounded border border-divider px-2 py-1"
			data-status={selected ? 'active' : undefined}
			onClick={onClick}
		>
			<div className="flex shrink-1 basis-full flex-col gap-0.5 overflow-hidden">
				<div className="flex items-center gap-1.5">
					<IndexTypeIcon type={entry.mainType} className="text-symbol" />
					<h4 className="truncate text-sm">{entry.name}</h4>
					{entry.sense && (
						<span className="truncate text-sm text-secondary">
							<em>({entry.sense})</em>
						</span>
					)}
				</div>
				{extras.length > 0 && (
					<div className="flex items-baseline gap-1">
						{extras.flatMap((extra, i) =>
							i === 0
								? [extra]
								: [
										<span key={`bullet-${i}`} className="text-xs text-hint">
											•
										</span>,
										extra,
									]
						)}
					</div>
				)}
				{entry.notes && <span className="line-clamp-1 text-xs text-secondary">{entry.notes}</span>}
			</div>
			{entry.canonicalMediaUrl && (
				<div className="relative w-16 self-stretch overflow-hidden rounded bg-tint">
					<img
						src={entry.canonicalMediaUrl}
						alt=""
						className="absolute inset-0 h-full w-full object-cover"
					/>
				</div>
			)}
		</div>
	);
};

export const IndexTypeIcon = ({ type, ...props }: { type: IndexMainType } & IconProps) => {
	let icon;
	switch (type) {
		case 'entity':
			icon = <EntityIcon {...props} />;
			break;
		case 'category':
			icon = <CategoryIcon {...props} />;
			break;
		case 'format':
			icon = <FormatIcon {...props} />;
			break;
		default:
			icon = <UnknownIcon {...props} />;
	}
	return icon;
};
