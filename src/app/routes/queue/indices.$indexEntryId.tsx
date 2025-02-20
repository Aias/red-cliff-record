import { Suspense, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { trpc } from '@/app/trpc';
import { RecordCategories, RecordCreators } from './-components/AssociationLists';
import { IndexEntryForm } from './-forms/IndexEntryForm';
import { IndexTypeIcon } from './indices';
import {
	Avatar,
	Button,
	ConnectIcon,
	IntegrationAvatar,
	MetadataDialogButton,
	Placeholder,
	Spinner,
} from '@/components';

export const Route = createFileRoute('/queue/indices/$indexEntryId')({
	component: RouteComponent,
	loader: async ({ context: { trpc, queryClient }, params }) => {
		await queryClient.ensureQueryData(trpc.indices.get.queryOptions(Number(params.indexEntryId)));
	},
});

function RouteComponent() {
	return (
		<Suspense
			fallback={
				<Placeholder>
					<Spinner />
				</Placeholder>
			}
		>
			<IndexEntryContent />
		</Suspense>
	);
}

function IndexEntryContent() {
	const { indexEntryId: idParam } = Route.useParams();
	const { type } = Route.useSearch();
	const navigate = Route.useNavigate();
	const indexEntryId = useMemo(() => Number(idParam), [idParam]);
	const [indexEntry] = trpc.indices.get.useSuspenseQuery(indexEntryId);
	const { data: relatedEntries } = trpc.indices.search.useQuery(indexEntry.name);
	const utils = trpc.useUtils();

	const mergeMutation = trpc.indices.merge.useMutation({
		onSuccess: (data) => {
			console.log('Merge data: ', data);
			utils.indices.get.invalidate(indexEntryId);
			utils.indices.get.invalidate(data.newEntry.id);
			utils.indices.search.invalidate();
			utils.indices.getQueue.invalidate();
			utils.indices.getQueueCount.invalidate();
			utils.relations.getRecordsForCategory.invalidate(data.newEntry.id);
			utils.relations.getRecordsByCreator.invalidate(data.newEntry.id);
			utils.relations.getRecordsWithFormat.invalidate(data.newEntry.id);
			navigate({
				to: '/queue/indices/$indexEntryId',
				params: { indexEntryId: data.newEntry.id.toString() },
				search: { type },
			});
		},
	});

	return (
		<div className="flex basis-full flex-col gap-3 overflow-auto p-3">
			<div className="flex items-center gap-2">
				<Avatar
					src={indexEntry.canonicalMediaUrl ?? undefined}
					fallback={indexEntry.name[0]!.toUpperCase()}
					className="shrink-0"
					inline
				/>
				<h2>{indexEntry.name}</h2>
				{indexEntry.sources && indexEntry.sources.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{indexEntry.sources.map((source) => (
							<IntegrationAvatar key={source} integration={source} className="size-5" inline />
						))}
					</div>
				) : null}
				<div className="flex-1 text-right">
					<MetadataDialogButton metadata={indexEntry} />
				</div>
			</div>
			{relatedEntries ? (
				<ol className="flex flex-col border-b border-rcr-border">
					{relatedEntries
						.filter((entry) => entry.id !== indexEntry.id)
						.slice(0, 3)
						.map((entry) => (
							<li
								key={entry.id}
								className="flex items-center gap-3 border-t border-rcr-border px-2 py-1 text-sm hover:bg-rcr-tint"
							>
								<div className="flex grow items-center gap-2">
									<IndexTypeIcon type={entry.mainType} className="text-rcr-symbol" />
									<Link
										to="/queue/indices/$indexEntryId"
										params={{ indexEntryId: entry.id.toString() }}
										search={{ type }}
										className="font-medium"
									>
										{entry.name}
									</Link>
									{entry.sense && <em className="text-rcr-secondary">({entry.sense})</em>}
									{entry.sources && entry.sources.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{entry.sources.map((source) => (
												<IntegrationAvatar
													key={source}
													integration={source}
													className="size-4 opacity-90"
												/>
											))}
										</div>
									) : null}
								</div>
								<Button
									onClick={() =>
										mergeMutation.mutate({ sourceId: indexEntry.id, targetId: entry.id })
									}
								>
									<ConnectIcon />
								</Button>
							</li>
						))}
				</ol>
			) : null}
			<div className="card shrink-0">
				<IndexEntryForm
					indexEntryId={indexEntryId}
					defaults={indexEntry}
					updateCallback={async () => {
						utils.indices.getQueue.invalidate();
						utils.indices.getQueueCount.invalidate();
					}}
				/>
			</div>
			<h3>Associated records</h3>
			{indexEntry.recordsInCategory.length > 0 ? (
				<>
					<h4>Records in Category</h4>
					<RecordCategories categoryId={indexEntry.id} />
				</>
			) : null}
			{indexEntry.recordsByCreator.length > 0 ? (
				<>
					<h4>Records by Creator</h4>
					<RecordCreators creatorId={indexEntry.id} />
				</>
			) : null}
		</div>
	);
}
