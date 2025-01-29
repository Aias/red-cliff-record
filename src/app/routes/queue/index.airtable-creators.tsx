import { createFileRoute } from '@tanstack/react-router';
import { formatCreatorDescription, toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { AirtableCreatorSelect } from '~/server/db/schema/integrations';
import type { IndicesInsert, IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { IndexEntryForm } from './-forms/IndexEntryForm';

export const Route = createFileRoute('/queue/index/airtable-creators')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getCreators.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<AirtableCreatorSelect, IndicesSelect, IndicesInsert> = {
	name: 'Airtable Creators',
	mapToQueueItem: (creator) => ({
		id: creator.id,
		title: creator.name,
		description: formatCreatorDescription(
			creator.type,
			creator.professions ?? undefined,
			creator.nationalities ?? undefined
		),
		externalUrl: creator.website,
		archivedAt: creator.archivedAt,
		mappedId: creator?.indexEntryId?.toString() ?? null,
	}),
	getOutputDefaults: (creator) => ({
		mainType: 'entity',
		subType: creator.type,
		name: creator.name,
		sense: creator.professions?.join(', '),
		canonicalUrl: creator.website,
		createdAt: creator.contentCreatedAt ?? creator.createdAt,
		updatedAt: creator.contentUpdatedAt ?? creator.updatedAt,
	}),
	getInputId: (creator) => creator.id,
	getOutputId: (index) => index.id.toString(),
	getInputTitle: (creator) => creator.name,
	getOutputTitle: (index) => `${index.name} (${index.sense ?? toTitleCase(index.mainType)})`,
};

function RouteComponent() {
	const [creators] = trpc.airtable.getCreators.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.indices.search.fetch;

	const createMutation = trpc.indices.createIndexEntry.useMutation({
		onSuccess: () => {
			utils.airtable.getCreators.invalidate();
			utils.indices.search.invalidate();
		},
	});
	const handleCreate = (creator: AirtableCreatorSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(creator));

	const linkMutation = trpc.airtable.linkCreatorToIndexEntry.useMutation({
		onSuccess: () => {
			utils.airtable.getCreators.invalidate();
		},
	});
	const handleLink = (creatorId: string, indexEntryId: string) =>
		linkMutation.mutateAsync({ creatorId, indexEntryId: Number(indexEntryId) });

	const unlinkMutation = trpc.airtable.unlinkCreatorsFromIndices.useMutation({
		onSuccess: () => {
			utils.airtable.getCreators.invalidate();
		},
	});
	const handleUnlink = (creatorIds: string[]) => unlinkMutation.mutateAsync(creatorIds);

	const archiveMutation = trpc.airtable.setCreatorsArchiveStatus.useMutation({
		onSuccess: () => {
			utils.airtable.getCreators.invalidate();
		},
	});
	const handleArchive = (creatorIds: string[]) =>
		archiveMutation.mutateAsync({ creatorIds, shouldArchive: true });

	const unarchiveMutation = trpc.airtable.setCreatorsArchiveStatus.useMutation({
		onSuccess: () => {
			utils.airtable.getCreators.invalidate();
		},
	});
	const handleUnarchive = (creatorIds: string[]) =>
		unarchiveMutation.mutateAsync({ creatorIds, shouldArchive: false });

	return (
		<QueueLayout
			items={creators}
			config={config}
			handleSearch={handleSearch}
			handleCreate={handleCreate}
			handleLink={handleLink}
			handleUnlink={handleUnlink}
			handleArchive={handleArchive}
			handleUnarchive={handleUnarchive}
		>
			{(mappedId, defaults) => (
				<IndexEntryForm
					defaults={defaults}
					indexEntryId={mappedId}
					updateCallback={async () => {
						utils.airtable.getCreators.invalidate();
						utils.indices.search.invalidate();
					}}
				/>
			)}
		</QueueLayout>
	);
}
