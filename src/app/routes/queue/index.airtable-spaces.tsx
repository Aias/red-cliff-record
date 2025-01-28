import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { AirtableSpaceSelect } from '~/server/db/schema/integrations';
import type { IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';

export const Route = createFileRoute('/queue/index/airtable-spaces')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getSpaces.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<AirtableSpaceSelect, IndicesSelect> = {
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
	lookup: (space) => space.name,
};

function RouteComponent() {
	const [spaces] = trpc.airtable.getSpaces.useSuspenseQuery();

	return <QueueLayout items={spaces} config={config} />;
}
