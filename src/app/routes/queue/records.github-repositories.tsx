import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import type { GithubRepositorySelect, GithubUserSelect } from '~/server/db/schema/github';
import type { RecordInsert, RecordSelect } from '~/server/db/schema/records';
import { QueueLayout } from './-components/QueueLayout';
import type { QueueConfig } from './-components/types';
import { RecordEntryForm } from './-forms/RecordEntryForm';

export const Route = createFileRoute('/queue/records/github-repositories')({
	component: RouteComponent,
	loader: async ({ context: { queryClient, trpc } }) => {
		await queryClient.ensureQueryData(trpc.github.getRepositories.queryOptions());
	},
});

type RepoWithOwner = GithubRepositorySelect & {
	owner?: GithubUserSelect;
};

const config: QueueConfig<RepoWithOwner, RecordSelect, RecordInsert> = {
	name: 'Github Repositories',
	mapToQueueItem: (repository) => ({
		id: repository.id.toString(),
		title: repository.fullName,
		description: repository.description,
		externalUrl: repository.htmlUrl,
		avatarUrl: repository.owner?.avatarUrl,
		archivedAt: repository.archivedAt,
		mappedId: repository.recordId?.toString() ?? null,
	}),
	getOutputDefaults: (repository) => ({
		type: 'resource',
		title: repository.fullName,
		content: repository.description,
		url: repository.htmlUrl,
	}),
	getInputId: (repository) => repository.id.toString(),
	getOutputId: (record) => record.id.toString(),
	getInputTitle: (repository) => repository.fullName,
	getOutputTitle: (record) => record.title ?? `Record ${record.id}`,
};

function RouteComponent() {
	const [repositories] = trpc.github.getRepositories.useSuspenseQuery();
	const utils = trpc.useUtils();

	const handleSearch = utils.records.search.fetch;

	const createMutation = trpc.records.create.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
		},
	});
	const handleCreate = (repository: RepoWithOwner) =>
		createMutation.mutateAsync(config.getOutputDefaults(repository));

	const linkMutation = trpc.github.linkRepositoryToRecord.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
		},
	});
	const handleLink = (repositoryId: string, recordId: string) =>
		linkMutation.mutateAsync({ repositoryId: Number(repositoryId), recordId: Number(recordId) });

	const unlinkMutation = trpc.github.unlinkRepositoriesFromRecords.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
		},
	});
	const handleUnlink = (repositoryIds: string[]) =>
		unlinkMutation.mutateAsync(repositoryIds.map(Number));

	const archiveMutation = trpc.github.setRepositoriesArchiveStatus.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
		},
	});
	const handleArchive = (repositoryIds: string[]) =>
		archiveMutation.mutateAsync({ repositoryIds: repositoryIds.map(Number), shouldArchive: true });

	const unarchiveMutation = trpc.github.setRepositoriesArchiveStatus.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
		},
	});
	const handleUnarchive = (repositoryIds: string[]) =>
		unarchiveMutation.mutateAsync({
			repositoryIds: repositoryIds.map(Number),
			shouldArchive: false,
		});

	const deleteOutputMutation = trpc.records.delete.useMutation({
		onSuccess: () => {
			utils.github.getRepositories.invalidate();
			utils.records.search.invalidate();
		},
	});
	const handleDeleteOutput = (recordId: string) =>
		deleteOutputMutation.mutateAsync(Number(recordId));

	return (
		<QueueLayout
			config={config}
			items={repositories}
			handleSearch={handleSearch}
			handleCreate={handleCreate}
			handleLink={handleLink}
			handleUnlink={handleUnlink}
			handleArchive={handleArchive}
			handleUnarchive={handleUnarchive}
			handleDeleteOutput={handleDeleteOutput}
		>
			{(recordId, defaults) => (
				<RecordEntryForm
					recordId={recordId}
					defaults={defaults}
					updateCallback={async () => {
						utils.github.getRepositories.invalidate();
						if (utils.records.search.invalidate) {
							utils.records.search.invalidate();
						}
					}}
				/>
			)}
		</QueueLayout>
	);
}
