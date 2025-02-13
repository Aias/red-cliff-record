import { ArchiveIcon, CubeIcon, PersonIcon, QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { Badge, Em, Heading, Link, Spinner, TabNav, Text, type TextProps } from '@radix-ui/themes';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { z } from 'zod';
import { IconWrapper } from '~/app/components/IconWrapper';
import { Placeholder } from '~/app/components/Placeholder';
import { TabNavLink } from '~/app/components/TabNavLink';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import { IndexMainType, type IndicesSelect } from '~/server/db/schema';

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
				<div className="flex items-center justify-between border-b border-divider">
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
					<Badge size="2" className="mr-3">
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
			<Text key="subtype" size="1" truncate wrap="nowrap">
				{toTitleCase(entry.subType)}
			</Text>
		);
	}
	if (entry.shortName) {
		extras.push(
			<Text key="short-name" size="1" truncate wrap="nowrap">
				{entry.shortName}
			</Text>
		);
	}
	if (entry.canonicalUrl) {
		extras.push(
			<Link
				key="canonical-url"
				size="1"
				href={entry.canonicalUrl}
				target="_blank"
				truncate
				wrap="nowrap"
			>
				{new URL(entry.canonicalUrl).hostname}
			</Link>
		);
	}

	return (
		<div
			className={`flex selectable gap-2 rounded border border-divider px-2 py-1`}
			data-status={selected ? 'active' : undefined}
			onClick={onClick}
		>
			<div className="flex shrink-1 basis-full flex-col gap-0.5 overflow-hidden">
				<div className="flex items-center gap-1.5">
					<IndexTypeIcon type={entry.mainType} />
					<Heading size="2" as="h4" wrap="nowrap" truncate>
						{entry.name}
					</Heading>
					{entry.sense && (
						<Text size="2" color="gray" wrap="nowrap" truncate>
							<Em>({entry.sense})</Em>
						</Text>
					)}
				</div>
				{extras.length > 0 && (
					<div className="flex items-baseline gap-1">
						{extras.flatMap((extra, i) =>
							i === 0
								? [extra]
								: [
										<Text size="1" key={`bullet-${i}`} className="text-hint">
											•
										</Text>,
										extra,
									]
						)}
					</div>
				)}
				{entry.notes && (
					<Text size="1" color="gray" className="line-clamp-1">
						{entry.notes}
					</Text>
				)}
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

export const IndexTypeIcon = ({ type, ...props }: { type: IndexMainType } & TextProps) => {
	let icon;
	switch (type) {
		case 'entity':
			icon = <PersonIcon />;
			break;
		case 'category':
			icon = <ArchiveIcon />;
			break;
		case 'format':
			icon = <CubeIcon />;
			break;
		default:
			icon = <QuestionMarkCircledIcon />;
	}
	return (
		<IconWrapper color="gray" size="2" {...props}>
			{icon}
		</IconWrapper>
	);
};
