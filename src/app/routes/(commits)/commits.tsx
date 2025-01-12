import { CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons';
import { Button, Card, Heading, ScrollArea } from '@radix-ui/themes';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { createServerFn } from '@tanstack/start';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { DataGrid } from '~/app/components/DataGrid';
import { useBatchOperation } from '~/app/lib/useBatchOperation';
import { useSelection } from '~/app/lib/useSelection';
import { db } from '~/db/connections';
import { githubCommits, type GithubCommitSelect } from '~//db/schema/integrations';
import { AppLink } from '../../components/AppLink';
import { Icon } from '../../components/Icon';
import { summarizeCommit } from './-summarizer';
import { CommitSummaryInputSchema } from './commits.$sha';
import styles from './commits.module.css';

const fetchCommits = createServerFn({ method: 'GET' }).handler(async () => {
	const commits = await db.query.githubCommits.findMany({
		with: {
			repository: true,
			commitChanges: true,
		},
		orderBy: [desc(githubCommits.committedAt)],
		limit: 50,
	});
	return { commits };
});

const commitsQueryOptions = () =>
	queryOptions({
		queryKey: ['commits'],
		queryFn: () => fetchCommits(),
	});

// Add new server function for batch summarization
const batchSummarizeCommits = createServerFn({ method: 'POST' })
	.validator(z.array(CommitSummaryInputSchema))
	.handler(async ({ data }) => {
		// Process commits in parallel
		const summaries = await Promise.all(
			data.map(async (commitSummaryInput) => {
				const summary = await summarizeCommit(JSON.stringify(commitSummaryInput));

				// Update database
				await db
					.update(githubCommits)
					.set({
						commitType: summary.primary_purpose,
						summary: summary.summary,
						technologies: summary.technologies,
					})
					.where(eq(githubCommits.sha, commitSummaryInput.sha));

				return { sha: commitSummaryInput.sha, summary };
			})
		);

		return { summaries };
	});

export const Route = createFileRoute('/(commits)/commits')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(commitsQueryOptions());
	},
	component: CommitList,
});

const columns: ColumnDef<GithubCommitSelect>[] = [
	{
		accessorKey: 'sha',
		header: 'SHA',
		cell: ({ row }) => (
			<AppLink to={`/commits/$sha`} params={{ sha: row.original.sha }}>
				{row.original.sha.slice(0, 7)}
			</AppLink>
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
			return summary ? (
				<Icon color="grass">
					<CheckCircledIcon />
				</Icon>
			) : (
				<Icon>
					<CircleIcon />
				</Icon>
			);
		},
	},
];

function CommitList() {
	const {
		data: { commits },
	} = useSuspenseQuery(commitsQueryOptions());
	const navigate = useNavigate();
	const { selectedIds, setSelection, clearSelection } = useSelection(
		commits.map((commit) => ({ id: commit.sha }))
	);
	const queryClient = useQueryClient();

	const batchOperation = useBatchOperation({
		selectedIds,
		clearSelection,
		queryClient,
		invalidateKeys: [['commits'], ...Array.from(selectedIds).map((sha) => ['commit', sha])],
		prepareData: (shas) =>
			shas.map((sha) => {
				const commit = commits.find((c) => c.sha === sha)!;
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
			}),
		operation: batchSummarizeCommits,
	});

	return (
		<main className={`flex h-full gap-2 overflow-hidden p-3 ${styles.layout}`}>
			<Card>
				<header className="mb-4 flex items-center justify-between gap-2">
					<Heading size="6">Recent Commits</Heading>
					{selectedIds.size > 0 && (
						<Button onClick={batchOperation.execute} disabled={batchOperation.processing}>
							{batchOperation.processing
								? 'Summarizing...'
								: `Summarize ${selectedIds.size} Commits`}
						</Button>
					)}
				</header>
				<ScrollArea>
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
						rootProps={{
							variant: 'ghost',
						}}
					/>
				</ScrollArea>
			</Card>
			<Outlet />
		</main>
	);
}
