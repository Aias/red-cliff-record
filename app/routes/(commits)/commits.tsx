import { useMemo, useState } from 'react';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { Card, Heading, ScrollArea, Button } from '@radix-ui/themes';
import { createServerFn } from '@tanstack/start';
import { db } from '@/db/connections';
import { githubCommits, GithubCommitSelect } from '@schema/integrations';
import { AppLink } from '../../components/AppLink';
import { Icon } from '../../components/Icon';
import { cn } from '@/app/lib/classNames';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons';
import { summarizeCommit } from '../../lib/commit-summarizer';
import { CommitSummaryInputSchema } from './commits.$sha';
import { DataGrid } from '@/app/components/DataGrid';
import type { ColumnDef } from '@tanstack/react-table';
import styles from './commits.module.css';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { invalidateQueries } from '@/app/lib/query-helpers';
import { useSelection } from '@/app/lib/useSelection';

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

function CommitList() {
	const {
		data: { commits },
	} = useSuspenseQuery(commitsQueryOptions());
	const navigate = useNavigate();
	const [isSummarizing, setIsSummarizing] = useState(false);
	const { selectedIds, toggleSelection, setSelection } = useSelection(
		commits.map((commit) => ({ id: commit.sha }))
	);
	const queryClient = useQueryClient();

	const columns = useMemo<ColumnDef<GithubCommitSelect>[]>(
		() => [
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
		],
		[]
	);

	const handleBatchSummarize = async () => {
		if (selectedIds.size === 0) return;

		setIsSummarizing(true);
		try {
			await batchSummarizeCommits({
				data: Array.from(selectedIds).map((sha) => {
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
			});
			await invalidateQueries(queryClient, [
				['commits'],
				...Array.from(selectedIds).map((sha) => ['commit', sha]),
			]);
		} catch (error) {
			console.error('Error batch summarizing commits:', error);
		} finally {
			setIsSummarizing(false);
		}
	};

	return (
		<main className={cn('p-3 flex h-full gap-2 overflow-hidden', styles.layout)}>
			<Card>
				<header className="flex justify-between items-center mb-4 gap-2">
					<Heading size="6">Recent Commits</Heading>
					{selectedIds.size > 0 && (
						<Button onClick={handleBatchSummarize} disabled={isSummarizing}>
							{isSummarizing ? 'Summarizing...' : `Summarize ${selectedIds.size} Commits`}
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
							onSelectionChange: setSelection,
						}}
						onRowClick={(commit) => navigate({ to: '/commits/$sha', params: { sha: commit.sha } })}
						getRowId={(commit) => commit.sha}
					/>
				</ScrollArea>
			</Card>
			<Outlet />
		</main>
	);
}
