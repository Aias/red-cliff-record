import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { Card, Heading, Table, Flex, ScrollArea, Button, Checkbox } from '@radix-ui/themes';
import { createServerFn } from '@tanstack/start';
import { createConnection } from '@rcr/database';
import { githubCommits } from '@rcr/database/schema/integrations/github/schema';
import { desc, eq } from 'drizzle-orm';
import { AppLink } from '../../components/AppLink';
import { Icon } from '../../components/Icon';
import styles from './commits.module.css';
import { useNavigate } from '@tanstack/react-router';
import classNames from 'classnames';
import { CheckCircledIcon, CircleIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { CommitInput, RepositoryInput } from './commits.$sha';
import { summarizeCommit } from '../../lib/commit-summarizer';
const fetchCommits = createServerFn({ method: 'GET' }).handler(async () => {
	const db = createConnection();
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
	.validator(
		(data: {
			commits: Array<{
				commit: CommitInput;
				repository: RepositoryInput;
			}>;
		}) => data
	)
	.handler(async ({ data }) => {
		const db = createConnection();

		// Process commits in parallel
		const summaries = await Promise.all(
			data.commits.map(async ({ commit, repository }) => {
				const summary = await summarizeCommit(JSON.stringify({ commit, repository }));

				// Update database
				await db
					.update(githubCommits)
					.set({
						commitType: summary.primary_purpose,
						summary: summary.summary,
						technologies: summary.technologies,
					})
					.where(eq(githubCommits.sha, commit.sha));

				return { sha: commit.sha, summary };
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
				data: {
					commits: Array.from(selectedCommits).map((sha) => {
						const commit = commits.find((c) => c.sha === sha)!;
						return {
							commit: {
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
							},
							repository: {
								fullName: commit.repository.fullName,
								description: commit.repository.description,
								language: commit.repository.language,
								topics: commit.repository.topics,
								licenseName: commit.repository.licenseName,
							},
						};
					}),
				},
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
		<Flex
			gap="2"
			width="100%"
			height="100%"
			overflow="hidden"
			justify="center"
			p="3"
			className={styles.container}
		>
			<Card className={styles.commitList}>
				<Flex justify="between" align="center" mb="4">
					<Heading size="6">Recent Commits</Heading>
					{selectedCommits.size > 0 && (
						<Button onClick={handleBatchSummarize} disabled={loading} variant="soft">
							{loading ? 'Summarizing...' : `Summarize ${selectedCommits.size} Commits`}
						</Button>
					)}
				</Flex>
				<ScrollArea>
					<Table.Root className={styles.commitListTable}>
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
									className={classNames({
										[styles.selected]: sha === commit.sha,
										[styles.commitRow]: true,
									})}
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
		</Flex>
	);
}
