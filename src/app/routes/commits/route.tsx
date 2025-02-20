import { useCallback } from 'react';
import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { trpc } from '@/app/trpc';
import { type CommitSummaryInput } from '@/server/api/routers/github.types';
import {
	type GithubCommitChangeSelect,
	type GithubCommitSelect,
	type GithubRepositorySelect,
} from '@/server/db/schema/github';
import { Button, CompleteIcon, DataGrid, IncompleteIcon } from '@/components';
import { useSelection } from '@/lib/useSelection';

type CommitSelect = Omit<GithubCommitSelect, 'textEmbedding'> & {
	repository: GithubRepositorySelect;
	commitChanges: GithubCommitChangeSelect[];
};

export const mapCommitToInput = (commit: CommitSelect): CommitSummaryInput => {
	return {
		message: commit.message,
		sha: commit.sha,
		changes: commit.changes,
		additions: commit.additions,
		deletions: commit.deletions,
		commitChanges: commit.commitChanges.map((change) => ({
			filename: change.filename,
			status: change.status,
			changes: change.changes,
			deletions: change.deletions,
			additions: change.additions,
			patch: change.patch,
		})),
		repository: {
			fullName: commit.repository.fullName,
			description: commit.repository.description,
			language: commit.repository.language,
			topics: commit.repository.topics,
			licenseName: commit.repository.licenseName,
		},
	};
};

export const Route = createFileRoute('/commits')({
	loader: async ({ context: { trpc, queryClient } }) => {
		await queryClient.ensureQueryData(trpc.github.getCommits.queryOptions());
	},
	component: CommitList,
});

const columns: ColumnDef<CommitSelect>[] = [
	{
		accessorKey: 'sha',
		header: 'SHA',
		cell: ({ row }) => (
			<Link to={`/commits/$sha`} params={{ sha: row.original.sha }}>
				{row.original.sha.slice(0, 7)}
			</Link>
		),
	},
	{
		accessorKey: 'repository.name',
		header: 'Repository',
	},
	{
		accessorKey: 'message',
		header: 'Message',
	},
	{
		accessorKey: 'committedAt',
		header: 'Date',
		cell: ({ getValue }) => {
			const date = getValue() as Date | null;
			return date ? new Date(date).toLocaleDateString() : '';
		},
	},
	{
		accessorKey: 'summary',
		header: 'Summarized',
		meta: {
			columnProps: {
				align: 'center',
			},
		},
		cell: ({ getValue }) => {
			const summary = getValue();
			return (
				<span className="text-sm">
					{summary ? <CompleteIcon className="themed" /> : <IncompleteIcon />}
				</span>
			);
		},
	},
];

function CommitList() {
	const [commits, commitsQuery] = trpc.github.getCommits.useSuspenseQuery();
	const trpcUtils = trpc.useUtils();
	const navigate = useNavigate();
	const { selectedIds, setSelection, clearSelection } = useSelection(
		commits.map((commit) => ({ id: commit.sha }))
	);

	const batchSummarizeCommits = trpc.github.summarizeCommits.useMutation({
		onSuccess: async () => {
			await commitsQuery.refetch();
			trpcUtils.github.getCommitBySha.invalidate();
			clearSelection();
		},
	});

	const handleBatchSummarize = useCallback(() => {
		const selectedCommits = Array.from(selectedIds).map((sha) => {
			const commit = commits.find((c) => c.sha === sha)!;
			return mapCommitToInput(commit);
		});

		batchSummarizeCommits.mutate(selectedCommits);
	}, [batchSummarizeCommits, selectedIds, commits]);

	return (
		<main className="@container flex h-full gap-2 overflow-hidden p-3">
			<div className="card min-w-[max(420px,50%)] grow basis-0">
				<header className="mb-4 flex items-center justify-between gap-2">
					<h1>Recent Commits</h1>
					{selectedIds.size > 0 && (
						<Button onClick={handleBatchSummarize} disabled={batchSummarizeCommits.isPending}>
							{batchSummarizeCommits.isPending
								? 'Summarizing...'
								: `Summarize ${selectedIds.size} Commits`}
						</Button>
					)}
				</header>
				<div className="h-full overflow-auto">
					<DataGrid
						data={commits}
						columns={columns}
						sorting={true}
						selection={{
							enabled: true,
							selectedIds,
							onSelectionChange: setSelection,
						}}
						onRowClick={(commit) => navigate({ to: '/commits/$sha', params: { sha: commit.sha } })}
						getRowId={(commit) => commit.sha}
					/>
				</div>
			</div>
			<Outlet />
		</main>
	);
}
