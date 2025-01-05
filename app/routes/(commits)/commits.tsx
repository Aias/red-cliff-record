import { z } from 'zod';
import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { Card, Heading, Table, ScrollArea, Button, Checkbox } from '@radix-ui/themes';
import { createServerFn } from '@tanstack/start';
import { db } from '@/db/connections';
import { githubCommits } from '@/db/schema/integrations/github';
import { desc, eq } from 'drizzle-orm';
import { AppLink } from '../../components/AppLink';
import { Icon } from '../../components/Icon';

import { useNavigate } from '@tanstack/react-router';
import classNames from 'classnames';
import { CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { summarizeCommit } from '../../lib/commit-summarizer';
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
	loader: () => fetchCommits(),
	component: CommitList,
});

function CommitList() {
	const { commits } = Route.useLoaderData();
	const navigate = useNavigate();
	const { sha } = useParams({ strict: false });
	const [selectedCommits, setSelectedCommits] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(false);

	const handleBatchSummarize = async () => {
		setLoading(true);
		try {
			await batchSummarizeCommits({
				data: Array.from(selectedCommits).map((sha) => {
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
			// Clear selection after successful summarization
			setSelectedCommits(new Set());
		} catch (error) {
			console.error('Error batch summarizing commits:', error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className={classNames('p-3 flex h-full gap-2 overflow-hidden', styles.layout)}>
			<Card>
				<header className="flex justify-between items-center mb-4 gap-2">
					<Heading size="6">Recent Commits</Heading>
					{selectedCommits.size > 0 && (
						<Button onClick={handleBatchSummarize} disabled={loading} variant="soft">
							{loading ? 'Summarizing...' : `Summarize ${selectedCommits.size} Commits`}
						</Button>
					)}
				</header>
				<ScrollArea>
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.ColumnHeaderCell title="Select Commits to Summarize"></Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>SHA</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Repository</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
								<Table.ColumnHeaderCell align="center">Summarized</Table.ColumnHeaderCell>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{commits.map((commit) => (
								<Table.Row
									key={commit.sha}
									onClick={(e) => {
										// Don't navigate if clicking checkbox
										if ((e.target as HTMLElement).closest('.checkbox')) return;
										navigate({ to: '/commits/$sha', params: { sha: commit.sha } });
									}}
									className={classNames(
										'cursor-pointer',
										sha === commit.sha ? 'bg-accent-a2 hover:bg-accent-a3' : 'hover:bg-gray-a2'
									)}
								>
									<Table.Cell className="checkbox">
										<Checkbox
											checked={selectedCommits.has(commit.sha)}
											onClick={(e) => {
												e.stopPropagation();
												setSelectedCommits((prev) => {
													const next = new Set(prev);
													if (next.has(commit.sha)) {
														next.delete(commit.sha);
													} else {
														next.add(commit.sha);
													}
													return next;
												});
											}}
										/>
									</Table.Cell>
									<Table.Cell>
										<AppLink to={`/commits/$sha`} params={{ sha: commit.sha }}>
											{commit.sha.slice(0, 7)}
										</AppLink>
									</Table.Cell>
									<Table.Cell>{commit.repository.name}</Table.Cell>
									<Table.Cell>{commit.message}</Table.Cell>
									<Table.Cell>
										{commit.committedAt ? new Date(commit.committedAt).toLocaleDateString() : ''}
									</Table.Cell>
									<Table.Cell align="center">
										{commit.summary ? (
											<Icon color="grass">
												<CheckCircledIcon />
											</Icon>
										) : (
											<Icon>
												<CircleIcon />
											</Icon>
										)}
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table.Root>
				</ScrollArea>
			</Card>
			<Outlet />
		</main>
	);
}
