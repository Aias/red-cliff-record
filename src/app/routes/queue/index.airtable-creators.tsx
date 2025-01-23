import { createFileRoute } from '@tanstack/react-router';
import { formatCreatorDescription } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { AirtableCreatorSelect } from '~/server/db/schema/integrations';
import type { IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';

export const Route = createFileRoute('/queue/index/airtable-creators')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.airtable.getCreators.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<AirtableCreatorSelect, IndicesSelect> = {
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
	getItemId: (creator) => creator.id,
	lookup: (creator) => creator.name,
};

function RouteComponent() {
	const [creators] = trpc.airtable.getCreators.useSuspenseQuery();

	return <QueueLayout items={creators} config={config} />;
}
