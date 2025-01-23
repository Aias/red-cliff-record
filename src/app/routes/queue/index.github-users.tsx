import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { GithubUserSelect } from '~/server/db/schema/integrations';
import type { IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';

export const Route = createFileRoute('/queue/index/github-users')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.github.getUsers.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<GithubUserSelect, IndicesSelect> = {
	name: 'Github Users',
	mapToQueueItem: (user) => ({
		id: user.nodeId,
		title: user.login,
		description: user.bio,
		externalUrl: user.htmlUrl,
		avatarUrl: user.avatarUrl,
	}),
	getOutputDefaults: (user) => ({
		mainType: 'entity',
		subType: user.type,
		name: user.login,
		canonicalUrl: user.blog,
		createdAt: user.contentCreatedAt ?? user.createdAt,
		updatedAt: user.contentUpdatedAt ?? user.updatedAt,
	}),
	getItemId: (user) => user.nodeId,
	lookup: (user) => user.login,
};

function RouteComponent() {
	const [users] = trpc.github.getUsers.useSuspenseQuery();

	return <QueueLayout items={users} config={config} />;
}
