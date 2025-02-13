import { useCallback } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Button, Card, Code, Heading, IconButton, ScrollArea, Text } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '~/app/trpc';
import { AppLink } from '../../components/AppLink';
import { CodeBlock } from '../../components/CodeBlock';
import { mapCommitToInput } from './route';

export const Route = createFileRoute('/commits/$sha')({
	loader: async ({ context: { queryClient, trpc }, params: { sha } }) => {
		await queryClient.ensureQueryData(trpc.github.getCommitBySha.queryOptions(sha));

		return {
			title: `Commit ${sha}`,
		};
	},
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{
						title: loaderData.title,
					},
				]
			: undefined,
	}),
	component: CommitView,
});

function CommitView() {
	const { sha } = Route.useParams();
	const [commit, commitQuery] = trpc.github.getCommitBySha.useSuspenseQuery(sha);
	const { data: related } = trpc.github.getRelatedCommits.useQuery(commit.id);
	const trpcUtils = trpc.useUtils();

	const updateCommitSummary = trpc.github.summarizeCommits.useMutation({
		onSuccess: async () => {
			await commitQuery.refetch();
			trpcUtils.github.getCommits.invalidate();
		},
	});

	const handleAnalyze = useCallback(() => {
		updateCommitSummary.mutate([mapCommitToInput(commit)]);
	}, [commit]);

	return (
		<Card className="flex grow basis-full flex-col gap-4 overflow-hidden @max-[799px]:basis-full">
			<header className="flex items-center justify-between gap-2">
				<Heading size="6">Commit {commit.sha.slice(0, 7)}</Heading>
				<AppLink to={'/commits'} asChild>
					<IconButton size="1" variant="soft">
						<Cross1Icon />
					</IconButton>
				</AppLink>
			</header>
			<ScrollArea scrollbars="vertical">
				<div className="flex flex-col gap-4">
					<Text as="p">{commit.message}</Text>
					<Text as="p">
						Repository: <Code>{commit.repository.fullName}</Code>
					</Text>
					<Text as="p">
						Changes: +{commit.additions} -{commit.deletions} ({commit.changes} total)
					</Text>

					<section>
						<header className="mb-3 flex items-center justify-between gap-2">
							<Heading size="4">Analysis</Heading>
							<Button
								onClick={handleAnalyze}
								disabled={updateCommitSummary.isPending}
								variant="soft"
							>
								{updateCommitSummary.isPending ? 'Analyzing...' : 'Analyze Commit'}
							</Button>
						</header>

						{updateCommitSummary.error && (
							<Card>
								<Text color="red" as="p">
									{updateCommitSummary.error.message}
								</Text>
							</Card>
						)}

						{commit.summary ? (
							<CodeBlock>
								{JSON.stringify(
									{
										type: commit.commitType,
										summary: commit.summary,
										technologies: commit.technologies,
									},
									null,
									2
								)}
							</CodeBlock>
						) : (
							<Card>
								<Text color="gray" align="center" as="p">
									No Summary Generated
								</Text>
							</Card>
						)}
					</section>

					<section>
						<header className="mb-3 flex items-center justify-between gap-2">
							<Heading size="4">Changed Files</Heading>
						</header>
						<ul className="flex list-none flex-col gap-2 p-0">
							{commit.commitChanges.map((change) => (
								<li key={change.id}>
									<Code variant="ghost">{change.filename}</Code>
								</li>
							))}
						</ul>
					</section>

					<section>
						<header className="mb-3">
							<Heading size="4">Related Commits</Heading>
						</header>
						{related && related.length > 0 ? (
							<ol className="flex flex-col gap-3">
								{related.map((relatedCommit) => (
									<li key={relatedCommit.id} className="card">
										<div className="flex flex-col gap-2">
											<div className="flex items-baseline justify-between gap-2">
												<AppLink size="2" to="/commits/$sha" params={{ sha: relatedCommit.sha }}>
													<Code variant="ghost" weight="medium">
														{relatedCommit.repository.fullName}:
													</Code>
													<Text as="span">#{relatedCommit.sha.slice(0, 7)}</Text>
												</AppLink>
												<Text size="1" color="gray">
													Score: {relatedCommit.similarity.toFixed(3)}
												</Text>
											</div>
											<Text as="p" size="2">
												{relatedCommit.message}
											</Text>
											{relatedCommit.summary && (
												<Text size="1" color="gray" as="p">
													{relatedCommit.summary.length > 200
														? `${relatedCommit.summary.slice(0, 350)}...`
														: relatedCommit.summary}
												</Text>
											)}
										</div>
									</li>
								))}
							</ol>
						) : (
							<Card>
								<Text color="gray" align="center" as="p">
									{commit.textEmbedding ? 'No related commits found.' : 'No embedding for commit.'}
								</Text>
							</Card>
						)}
					</section>
				</div>
			</ScrollArea>
		</Card>
	);
}
