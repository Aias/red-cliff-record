import { createFileRoute } from '@tanstack/react-router';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { AirtableSpaceSelect } from '~/server/db/schema/integrations';
import type { IndicesInsert, IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';

export const Route = createFileRoute('/queue/index/airtable-spaces')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getSpaces.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<AirtableSpaceSelect, IndicesSelect, IndicesInsert> = {
	name: 'Airtable Spaces',
	mapToQueueItem: (space) => ({
		id: space.id,
		title: space.name,
		description: space.fullName,
	}),
	getOutputDefaults: (space) => ({
		mainType: 'category',
		name: space.name,
		createdAt: space.contentCreatedAt ?? space.createdAt,
		updatedAt: space.contentUpdatedAt ?? space.updatedAt,
	}),
	getInputId: (space) => space.id,
	getOutputId: (index) => index.id.toString(),
	getInputTitle: (space) => space.name,
	getOutputTitle: (index) => `${index.name} (${index.sense ?? toTitleCase(index.mainType)})`,
};

function RouteComponent() {
	const [spaces] = trpc.airtable.getSpaces.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.indices.search.fetch;

	const createMutation = trpc.indices.createIndexEntry.useMutation();
	const handleCreate = (space: AirtableSpaceSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(space));

	const linkMutation = trpc.airtable.linkSpaceToIndexEntry.useMutation();
	const handleLink = (spaceId: string, indexEntryId: string) =>
		linkMutation.mutateAsync({ spaceId, indexEntryId: Number(indexEntryId) });

	const unlinkMutation = trpc.airtable.unlinkSpacesFromIndices.useMutation();
	const handleUnlink = (spaceIds: string[]) => unlinkMutation.mutateAsync(spaceIds);

	const archiveMutation = trpc.airtable.setSpacesArchiveStatus.useMutation();
	const handleArchive = (spaceIds: string[]) =>
		archiveMutation.mutateAsync({ spaceIds, shouldArchive: true });

	const unarchiveMutation = trpc.airtable.setSpacesArchiveStatus.useMutation();
	const handleUnarchive = (spaceIds: string[]) =>
		unarchiveMutation.mutateAsync({ spaceIds, shouldArchive: false });

	return (
		<QueueLayout
			items={spaces}
			config={config}
			handleSearch={handleSearch}
			handleCreate={handleCreate}
			handleLink={handleLink}
			handleUnlink={handleUnlink}
			handleArchive={handleArchive}
			handleUnarchive={handleUnarchive}
		/>
	);
}
