import { createFileRoute } from '@tanstack/react-router';
import { toTitleCase } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { GithubUserSelect } from '~/server/db/schema/integrations';
import type { IndicesInsert, IndicesSelect } from '~/server/db/schema/main';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';

export const Route = createFileRoute('/queue/index/github-users')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.github.getUsers.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<GithubUserSelect, IndicesSelect, IndicesInsert> = {
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
	getInputId: (user) => user.nodeId,
	getOutputId: (index) => index.id.toString(),
	getInputTitle: (user) => user.login,
	getOutputTitle: (index) => `${index.name} (${index.sense ?? toTitleCase(index.mainType)})`,
};

function RouteComponent() {
	const [users] = trpc.github.getUsers.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.indices.search.fetch;

	const createMutation = trpc.indices.createIndexEntry.useMutation();
	const handleCreate = (user: GithubUserSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(user));

	const linkMutation = trpc.github.linkUserToIndexEntry.useMutation();
	const handleLink = (userId: string, indexEntryId: string) =>
		linkMutation.mutateAsync({ userId: Number(userId), indexEntryId: Number(indexEntryId) });

	const unlinkMutation = trpc.github.unlinkUsersFromIndices.useMutation();
	const handleUnlink = (userIds: string[]) => unlinkMutation.mutateAsync(userIds.map(Number));

	const archiveMutation = trpc.github.setUsersArchiveStatus.useMutation();
	const handleArchive = (userIds: string[]) =>
		archiveMutation.mutateAsync({ userIds: userIds.map(Number), shouldArchive: true });

	const unarchiveMutation = trpc.github.setUsersArchiveStatus.useMutation();
	const handleUnarchive = (userIds: string[]) =>
		unarchiveMutation.mutateAsync({ userIds: userIds.map(Number), shouldArchive: false });

	return (
		<QueueLayout
			items={users}
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
