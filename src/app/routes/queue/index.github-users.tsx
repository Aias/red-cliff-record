import { createFileRoute } from '@tanstack/react-router';
import { toTitleCase, validateAndFormatUrl } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { GithubUserSelect } from '~/server/db/schema/github';
import type { IndicesInsert, IndicesSelect } from '~/server/db/schema/indices';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { IndexEntryForm } from './-forms/IndexEntryForm';

export const Route = createFileRoute('/queue/index/github-users')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.github.getUsers.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<GithubUserSelect, IndicesSelect, IndicesInsert> = {
	name: 'Github Users',
	mapToQueueItem: (user) => ({
		id: user.id.toString(),
		title: user.name ? `${user.name} (${user.login})` : user.login,
		description: user.bio,
		externalUrl: user.htmlUrl,
		avatarUrl: user.avatarUrl,
		archivedAt: user.archivedAt,
		mappedId: user?.indexEntryId?.toString() ?? null,
	}),
	getOutputDefaults: (user) => ({
		mainType: 'entity',
		subType: user.type === 'User' ? 'Individual' : user.type,
		name: user.name ?? user.login,
		shortName: user.name ? user.login : undefined,
		canonicalUrl: user.blog ? validateAndFormatUrl(user.blog) : undefined,
		canonicalMediaUrl: user.avatarUrl ? validateAndFormatUrl(user.avatarUrl) : undefined,
		notes: user.bio,
		createdAt: user.contentCreatedAt ?? user.createdAt,
		updatedAt: user.contentUpdatedAt ?? user.updatedAt,
	}),
	getInputId: (user) => user.id.toString(),
	getOutputId: (index) => index.id.toString(),
	getInputTitle: (user) => (user.name ? `${user.name} (${user.login})` : user.login),
	getOutputTitle: (index) => `${index.name} (${index.sense ?? toTitleCase(index.mainType)})`,
};

function RouteComponent() {
	const [users] = trpc.github.getUsers.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.indices.search.fetch;

	const createMutation = trpc.indices.create.useMutation({
		onSuccess: () => {
			utils.github.getUsers.invalidate();
			utils.indices.search.invalidate();
		},
	});
	const handleCreate = (user: GithubUserSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(user));

	const linkMutation = trpc.github.linkUserToIndexEntry.useMutation({
		onSuccess: () => {
			utils.github.getUsers.invalidate();
		},
	});
	const handleLink = (userId: string, indexEntryId: string) => {
		return linkMutation.mutateAsync({ userId: Number(userId), indexEntryId: Number(indexEntryId) });
	};

	const unlinkMutation = trpc.github.unlinkUsersFromIndices.useMutation({
		onSuccess: () => {
			utils.github.getUsers.invalidate();
		},
	});
	const handleUnlink = (userIds: string[]) => unlinkMutation.mutateAsync(userIds.map(Number));

	const archiveMutation = trpc.github.setUsersArchiveStatus.useMutation({
		onSuccess: () => {
			utils.github.getUsers.invalidate();
		},
	});
	const handleArchive = (userIds: string[]) =>
		archiveMutation.mutateAsync({ userIds: userIds.map(Number), shouldArchive: true });

	const unarchiveMutation = trpc.github.setUsersArchiveStatus.useMutation({
		onSuccess: () => {
			utils.github.getUsers.invalidate();
		},
	});
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
		>
			{(mappedId, defaults) => (
				<IndexEntryForm
					defaults={defaults}
					indexEntryId={mappedId}
					updateCallback={async () => {
						utils.github.getUsers.invalidate();
						utils.indices.search.invalidate();
					}}
				/>
			)}
		</QueueLayout>
	);
}
