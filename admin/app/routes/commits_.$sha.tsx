import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading, Text, Box, Button, Code, Flex } from '@radix-ui/themes';
import { eq } from 'drizzle-orm';
import { createServerFn } from '@tanstack/start';
import { createConnection } from '@rcr/database';
import { githubCommits } from '@rcr/database/schema/integrations/github/schema';
import { useState } from 'react';
import {
	commitSummarizerSchema,
	commitSummarizerInstructions,
	CommitSummarySchema,
} from '../lib/assistants';
import { z } from 'zod';
import { openai } from '../lib/assistants';
import { CodeBlock } from '../components/CodeBlock';

type CommitChange = {
	filename: string;
	status: string;
	changes: number | null;
	deletions: number | null;
	additions: number | null;
	patch: string;
};

type CommitInput = {
	message: string;
	sha: string;
	changes: number | null;
	additions: number | null;
	deletions: number | null;
	commitChanges: CommitChange[];
};

type RepositoryInput = {
	fullName: string;
	description: string | null;
	language: string | null;
	topics: string[] | null;
	licenseName: string | null;
};

const fetchCommitBySha = createServerFn({ method: 'GET' })
	.validator((data: string) => data)
	.handler(async ({ data: sha }) => {
		const db = createConnection();
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

type CommitSummary = z.infer<typeof CommitSummarySchema>;

const summarizeCommit = createServerFn({ method: 'POST' })
	.validator((data: { commit: CommitInput; repository: RepositoryInput }) => data)
	.handler(async ({ data: { commit, repository } }) => {
		const db = createConnection();

		const response = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			response_format: { type: 'json_schema', json_schema: commitSummarizerSchema },
			messages: [
				{
					role: 'system',
					content: commitSummarizerInstructions,
				},
				{
					role: 'user',
					content: JSON.stringify({ commit, repository }),
				},
			],
		});

		const rawContent = response.choices[0]?.message?.content;
		if (!rawContent) {
			throw new Error('No response from OpenAI');
		}

		// Parse and validate the response
		const summary = CommitSummarySchema.parse(JSON.parse(rawContent));

		// Save the summary to the database
		await db
			.update(githubCommits)
			.set({
				commitType: summary.primary_purpose,
				summary: summary.summary,
				technologies: summary.technologies,
			})
			.where(eq(githubCommits.sha, commit.sha));

		return { summary };
	});

export const Route = createFileRoute('/commits_/$sha')({
	loader: ({ params: { sha } }) => fetchCommitBySha({ data: sha }),
	component: CommitView,
});

function CommitView() {
	const { commit } = Route.useLoaderData();
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

	const handleAnalyze = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await summarizeCommit({
				data: {
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
		<Container size="3" p="4">
			<Card>
				<Heading size="6" mb="4">
					Commit {commit.sha.slice(0, 7)}
				</Heading>
				<Text as="p" mb="4">
					{commit.message}
				</Text>
				<Text as="p" mb="4">
					Repository: <Code>{commit.repository.fullName}</Code>
				</Text>
				<Text as="p" mb="4">
					Changes: +{commit.additions} -{commit.deletions} ({commit.changes} total)
				</Text>

				<Box mt="4">
					<Flex justify="between" align="center" mb="2">
						<Heading size="4">Analysis</Heading>
						<Button onClick={handleAnalyze} disabled={loading} variant="soft">
							{loading ? 'Analyzing...' : summary ? 'Re-Analyze' : 'Analyze Commit'}
						</Button>
					</Flex>

					{error && (
						<Card mt="2">
							<Text color="red" as="p">
								{error}
							</Text>
						</Card>
					)}

					<Box mt="2">
						{summary ? (
							<CodeBlock>{JSON.stringify(summary, null, 2)}</CodeBlock>
						) : (
							<Card>
								<Text color="gray" align="center" as="p">
									No Summary Generated
								</Text>
							</Card>
						)}
					</Box>
				</Box>

				<Box mt="4">
					<Heading size="4" mb="2">
						Changed Files
					</Heading>
					<Flex direction="column" gap="2" align="start">
						{commit.commitChanges.map((change) => (
							<Code key={change.id} variant="ghost">
								{change.filename}
							</Code>
						))}
					</Flex>
				</Box>
			</Card>
		</Container>
	);
}
