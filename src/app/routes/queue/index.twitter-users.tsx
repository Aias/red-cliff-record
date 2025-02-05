import { createFileRoute } from '@tanstack/react-router';
import { toTitleCase, validateAndFormatUrl } from '~/app/lib/formatting';
import { trpc } from '~/app/trpc';
import type { IndicesInsert, IndicesSelect } from '~/server/db/schema/indices';
import type { TwitterUserSelect } from '~/server/db/schema/twitter';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { IndexEntryForm } from './-forms/IndexEntryForm';

export const Route = createFileRoute('/queue/index/twitter-users')({
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.twitter.getUsers.queryOptions());
	},
	component: RouteComponent,
});

const config: QueueConfig<TwitterUserSelect, IndicesSelect, IndicesInsert> = {
	name: 'Twitter Users',
	mapToQueueItem: (user) => ({
		id: user.id,
		title: user.displayName ? `${user.displayName} (@${user.username})` : `@${user.username}`,
		description: user.description,
		externalUrl: user.externalUrl ?? user.url,
		avatarUrl: user.profileImageUrl,
		archivedAt: user.archivedAt,
		mappedId: user?.indexEntryId?.toString() ?? null,
	}),
	getOutputDefaults: (user) => ({
		mainType: 'entity',
		subType: 'Individual',
		name: user.displayName,
		shortName: `@${user.username}`,
		canonicalUrl: user.externalUrl ? validateAndFormatUrl(user.externalUrl) : undefined,
		canonicalMediaUrl: user.profileImageUrl
			? validateAndFormatUrl(user.profileImageUrl)
			: undefined,
		notes: user.description,
		createdAt: user.contentCreatedAt ?? user.createdAt,
		updatedAt: user.contentUpdatedAt ?? user.updatedAt,
	}),
	getInputId: (user) => user.id,
	getOutputId: (index) => index.id.toString(),
	getInputTitle: (user) => `${user.displayName} (@${user.username})`,
	getOutputTitle: (index) => `${index.name} (${index.sense ?? toTitleCase(index.mainType)})`,
};

function RouteComponent() {
	const [users] = trpc.twitter.getUsers.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.indices.search.fetch;

	const createMutation = trpc.indices.create.useMutation({
		onSuccess: () => {
			utils.twitter.getUsers.invalidate();
			utils.indices.search.invalidate();
		},
	});
	const handleCreate = (user: TwitterUserSelect) =>
		createMutation.mutateAsync(config.getOutputDefaults(user));

	const linkMutation = trpc.twitter.linkUserToIndexEntry.useMutation({
		onSuccess: () => {
			utils.twitter.getUsers.invalidate();
		},
	});
	const handleLink = (userId: string, indexEntryId: string) =>
		linkMutation.mutateAsync({ userId, indexEntryId: Number(indexEntryId) });

	const unlinkMutation = trpc.twitter.unlinkUsersFromIndices.useMutation({
		onSuccess: () => {
			utils.twitter.getUsers.invalidate();
		},
	});
	const handleUnlink = (userIds: string[]) => unlinkMutation.mutateAsync(userIds);

	const archiveMutation = trpc.twitter.setUsersArchiveStatus.useMutation({
		onSuccess: () => {
			utils.twitter.getUsers.invalidate();
		},
	});
	const handleArchive = (userIds: string[]) =>
		archiveMutation.mutateAsync({ userIds, shouldArchive: true });

	const unarchiveMutation = trpc.twitter.setUsersArchiveStatus.useMutation({
		onSuccess: () => {
			utils.twitter.getUsers.invalidate();
		},
	});
	const handleUnarchive = (userIds: string[]) =>
		unarchiveMutation.mutateAsync({ userIds, shouldArchive: false });

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
						utils.twitter.getUsers.invalidate();
						utils.indices.search.invalidate();
					}}
				/>
			)}
		</QueueLayout>
	);
}
