import { Suspense, useMemo } from 'react';
import { Link2Icon } from '@radix-ui/react-icons';
import { Avatar, Card, Heading, IconButton, Spinner } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { AppLink } from '~/app/components/AppLink';
import { IntegrationAvatar } from '~/app/components/IntegrationAvatar';
import { MetadataDialogButton } from '~/app/components/MetadataList';
import { Placeholder } from '~/app/components/Placeholder';
import { trpc } from '~/app/trpc';
import { RecordCategories, RecordCreators } from './-components/AssociationLists';
import { IndexEntryForm } from './-forms/IndexEntryForm';
import { IndexTypeIcon } from './indices';

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
					<Spinner size="3" />
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
					size="2"
					src={indexEntry.canonicalMediaUrl ?? undefined}
					fallback={indexEntry.name[0]!.toUpperCase()}
					className="shrink-0"
				/>
				<Heading size="5" as="h2">
					{indexEntry.name}
				</Heading>
				{indexEntry.sources && indexEntry.sources.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{indexEntry.sources.map((source) => (
							<IntegrationAvatar key={source} integration={source} size="1" className="size-5" />
						))}
					</div>
				) : null}
				<div className="flex-1 text-right">
					<MetadataDialogButton metadata={indexEntry} />
				</div>
			</div>
			{relatedEntries ? (
				<ol className="flex flex-col border-b border-border">
					{relatedEntries
						.filter((entry) => entry.id !== indexEntry.id)
						.slice(0, 3)
						.map((entry) => (
							<li
								key={entry.id}
								className="flex items-center gap-3 border-t border-border px-2 py-1 hover:bg-tint"
							>
								<div className="flex grow gap-2">
									<IndexTypeIcon type={entry.mainType} />
									<Heading size="2" as="h4" weight="medium">
										<AppLink
											to="/queue/indices/$indexEntryId"
											params={{ indexEntryId: entry.id.toString() }}
											search={{ type }}
										>
											{entry.name}
										</AppLink>
									</Heading>
									{entry.sources && entry.sources.length > 0 ? (
										<div className="flex flex-wrap gap-1">
											{entry.sources.map((source) => (
												<IntegrationAvatar
													key={source}
													integration={source}
													size="1"
													className="size-4"
												/>
											))}
										</div>
									) : null}
								</div>
								<IconButton
									variant="soft"
									size="1"
									onClick={() =>
										mergeMutation.mutate({ sourceId: indexEntry.id, targetId: entry.id })
									}
								>
									<Link2Icon className="size-4" />
								</IconButton>
							</li>
						))}
				</ol>
			) : null}
			<Card className="shrink-0">
				<IndexEntryForm
					indexEntryId={indexEntryId}
					defaults={indexEntry}
					updateCallback={async () => {
						utils.indices.getQueue.invalidate();
						utils.indices.getQueueCount.invalidate();
					}}
				/>
			</Card>
			<Heading size="4" as="h3">
				Associated records
			</Heading>
			{indexEntry.recordsInCategory.length > 0 ? (
				<>
					<Heading size="3" as="h4" weight="medium">
						Records in Category
					</Heading>
					<RecordCategories categoryId={indexEntry.id} />
				</>
			) : null}
			{indexEntry.recordsByCreator.length > 0 ? (
				<>
					<Heading size="3" as="h4" weight="medium">
						Records by Creator
					</Heading>
					<RecordCreators creatorId={indexEntry.id} />
				</>
			) : null}
		</div>
	);
}
