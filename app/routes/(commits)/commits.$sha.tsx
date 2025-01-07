import { z } from 'zod';
import { createFileRoute } from '@tanstack/react-router';
import { Card, Heading, Text, Button, Code, ScrollArea, IconButton } from '@radix-ui/themes';
import { eq } from 'drizzle-orm';
import { createServerFn } from '@tanstack/start';
import { db } from '@/db/connections';
import { githubCommits } from '@schema/integrations';
import { useState, useEffect } from 'react';
import { CommitSummary, summarizeCommit } from '../../lib/commit-summarizer';
import { CodeBlock } from '../../components/CodeBlock';
import { AppLink } from '../../components/AppLink';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { Cross1Icon } from '@radix-ui/react-icons';

export const CommitSummaryInputSchema = z.object({
	message: z.string(),
	sha: z.string(),
	changes: z.number().nullable(),
	additions: z.number().nullable(),
	deletions: z.number().nullable(),
	commitChanges: z.array(
		z.object({
			filename: z.string(),
			status: z.string(),
			changes: z.number().nullable(),
			deletions: z.number().nullable(),
			additions: z.number().nullable(),
			patch: z.string(),
		})
	),
	repository: z.object({
		fullName: z.string(),
		description: z.string().nullable(),
		language: z.string().nullable(),
		topics: z.array(z.string()).nullable(),
		licenseName: z.string().nullable(),
	}),
});

const fetchCommitBySha = createServerFn({ method: 'GET' })
	.validator(z.string())
	.handler(async ({ data: sha }) => {
		const commit = await db.query.githubCommits.findFirst({
			where: eq(githubCommits.sha, sha),
			with: {
				repository: true,
				commitChanges: true,
			},
			columns: {
				sha: true,
				message: true,
				changes: true,
				additions: true,
				deletions: true,
				commitType: true,
				summary: true,
				technologies: true,
			},
		});

		if (!commit) {
			throw new Error('Commit not found');
		}

		return { commit };
	});

const commitQueryOptions = (sha: string) =>
	queryOptions({
		queryKey: ['commit', sha],
		queryFn: () => fetchCommitBySha({ data: sha }),
	});

export const updateCommitSummary = createServerFn({ method: 'POST' })
	.validator(CommitSummaryInputSchema)
	.handler(async ({ data: commitSummaryInput }) => {
		const summary = await summarizeCommit(JSON.stringify(commitSummaryInput));

		// Save the summary to the database
		await db
			.update(githubCommits)
			.set({
				commitType: summary.primary_purpose,
				summary: summary.summary,
				technologies: summary.technologies,
			})
			.where(eq(githubCommits.sha, commitSummaryInput.sha));

		return { summary };
	});

export const Route = createFileRoute('/(commits)/commits/$sha')({
	loader: async ({ context, params: { sha } }) => {
		await context.queryClient.ensureQueryData(commitQueryOptions(sha));

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
	const {
		data: { commit },
	} = useSuspenseQuery(commitQueryOptions(sha));
	const [summary, setSummary] = useState<CommitSummary | null>(
		commit.summary && commit.commitType
			? {
					primary_purpose: commit.commitType,
					summary: commit.summary,
					technologies: commit.technologies || [],
				}
			: null
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setSummary(
			commit.summary && commit.commitType
				? {
						primary_purpose: commit.commitType,
						summary: commit.summary,
						technologies: commit.technologies || [],
					}
				: null
		);
	}, [commit]);

	const handleAnalyze = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await updateCommitSummary({
				data: {
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
				},
			});
			setSummary(response.summary);
		} catch (error) {
			console.error('Error summarizing commit:', error);
			setError(error instanceof Error ? error.message : 'An unknown error occurred');
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="grow basis-full">
			<header className="flex justify-between items-center mb-4 gap-2">
				<Heading size="6">Commit {commit.sha.slice(0, 7)}</Heading>
				<AppLink to={'/commits'} asChild>
					<IconButton size="1" variant="soft">
						<Cross1Icon />
					</IconButton>
				</AppLink>
			</header>
			<ScrollArea>
				<div className="flex flex-col gap-4">
					<Text as="p">{commit.message}</Text>
					<Text as="p">
						Repository: <Code>{commit.repository.fullName}</Code>
					</Text>
					<Text as="p">
						Changes: +{commit.additions} -{commit.deletions} ({commit.changes} total)
					</Text>

					<section>
						<header className="flex justify-between items-center mb-3 gap-2">
							<Heading size="4">Analysis</Heading>
							<Button onClick={handleAnalyze} disabled={loading} variant="soft">
								{loading ? 'Analyzing...' : summary ? 'Re-Analyze' : 'Analyze Commit'}
							</Button>
						</header>

						{error && (
							<Card>
								<Text color="red" as="p">
									{error}
								</Text>
							</Card>
						)}

						{summary ? (
							<CodeBlock>{JSON.stringify(summary, null, 2)}</CodeBlock>
						) : (
							<Card>
								<Text color="gray" align="center" as="p">
									No Summary Generated
								</Text>
							</Card>
						)}
					</section>

					<section>
						<header className="flex justify-between items-center mb-3 gap-2">
							<Heading size="4">Changed Files</Heading>
						</header>
						<ul className="flex flex-col gap-2 list-none p-0">
							{commit.commitChanges.map((change) => (
								<li key={change.id}>
									<Code variant="ghost">{change.filename}</Code>
								</li>
							))}
						</ul>
					</section>
				</div>
			</ScrollArea>
		</Card>
	);
}
