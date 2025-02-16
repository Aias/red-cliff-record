import { useCallback } from 'react';
import { Button, Code, IconButton } from '@radix-ui/themes';
import { createFileRoute } from '@tanstack/react-router';
import { CloseIcon } from '~/app/components/icons';
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
		<div className="flex grow basis-full flex-col gap-4 overflow-hidden card @max-[799px]:basis-full">
			<header className="flex items-center justify-between gap-2">
				<h2>Commit {commit.sha.slice(0, 7)}</h2>
				<AppLink to={'/commits'} asChild>
					<IconButton size="1" variant="soft">
						<CloseIcon />
					</IconButton>
				</AppLink>
			</header>
			<div className="flex flex-col gap-4 overflow-auto">
				<p className="font-medium">{commit.message}</p>
				<p>
					Repository: <Code>{commit.repository.fullName}</Code>
				</p>
				<p>
					Changes: +{commit.additions} -{commit.deletions} ({commit.changes} total)
				</p>

				<section>
					<header className="mb-3 flex items-center justify-between gap-2">
						<h3>Analysis</h3>
						<Button onClick={handleAnalyze} disabled={updateCommitSummary.isPending} variant="soft">
							{updateCommitSummary.isPending ? 'Analyzing...' : 'Analyze Commit'}
						</Button>
					</header>

					{updateCommitSummary.error && (
						<p className="text-error card">{updateCommitSummary.error.message}</p>
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
						<p className="card text-center text-secondary">No Summary Generated</p>
					)}
				</section>

				<section>
					<header className="mb-3 flex items-center justify-between gap-2">
						<h3>Changed Files</h3>
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
						<h3>Related Commits</h3>
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
												<span>#{relatedCommit.sha.slice(0, 7)}</span>
											</AppLink>
											<span className="text-sm text-secondary">
												Score: {relatedCommit.similarity.toFixed(3)}
											</span>
										</div>
										<p>{relatedCommit.message}</p>
										{relatedCommit.summary && (
											<p className="text-sm text-secondary">
												{relatedCommit.summary.length > 200
													? `${relatedCommit.summary.slice(0, 350)}...`
													: relatedCommit.summary}
											</p>
										)}
									</div>
								</li>
							))}
						</ol>
					) : (
						<p className="card text-center text-secondary">
							{commit.textEmbedding ? 'No related commits found.' : 'No embedding for commit.'}
						</p>
					)}
				</section>
			</div>
		</div>
	);
}
