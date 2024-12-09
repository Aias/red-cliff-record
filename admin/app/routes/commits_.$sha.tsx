import { createFileRoute } from '@tanstack/react-router';
import { Container, Card, Heading, Text, Box, Button, Code } from '@radix-ui/themes';
import { eq } from 'drizzle-orm';
import { createServerFn } from '@tanstack/start';
import { createConnection } from '@rcr/database';
import { githubCommits } from '@rcr/database/schema/integrations/github/schema';
import { useState } from 'react';
import { assistant } from '../lib/assistants';

import OpenAI from 'openai';

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
		});

		if (!commit) {
			throw new Error('Commit not found');
		}

		return { commit };
	});

const summarizeCommit = createServerFn({ method: 'POST' })
	.validator((data: { commit: CommitInput; repository: RepositoryInput }) => data)
	.handler(async ({ data: { commit, repository } }) => {
		const openai = new OpenAI();
		const thread = await openai.beta.threads.create({
			messages: [
				{
					role: 'user',
					content: JSON.stringify({ commit, repository }),
				},
			],
		});

		const assistantResponse = await assistant;
		const run = await openai.beta.threads.runs.create(thread.id, {
			assistant_id: assistantResponse.id,
		});

		// Poll for completion
		let completedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
		while (completedRun.status !== 'completed') {
			if (completedRun.status === 'failed' || completedRun.status === 'cancelled') {
				throw new Error(
					`Run ${completedRun.status}: ${completedRun.last_error?.message || 'Unknown error'}`
				);
			}
			if (completedRun.status === 'expired') {
				throw new Error('Request timed out');
			}
			await new Promise((resolve) => setTimeout(resolve, 1000));
			completedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
		}

		const messages = await openai.beta.threads.messages.list(thread.id);
		const lastMessage = messages.data[0];
		if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
			return { summary: lastMessage.content[0] };
		}
		throw new Error('Unexpected response format from assistant');
	});

export const Route = createFileRoute('/commits_/$sha')({
	loader: ({ params: { sha } }) => fetchCommitBySha({ data: sha }),
	component: CommitView,
});

function CommitView() {
	const { commit } = Route.useLoaderData();
	const [summary, setSummary] = useState<null | OpenAI.Beta.Threads.Messages.MessageContent>(null);
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
					Repository: {commit.repository.fullName}
				</Text>
				<Text as="p" mb="4">
					Changes: +{commit.additions} -{commit.deletions} ({commit.changes} total)
				</Text>

				<Button onClick={handleAnalyze} disabled={loading}>
					{loading ? 'Analyzing commit...' : 'Analyze Commit'}
				</Button>

				{error && (
					<Card mt="4">
						<Text color="red" as="p">
							{error}
						</Text>
					</Card>
				)}

				{summary && summary.type === 'text' && (
					<Box mt="4">
						<Heading size="4" mb="2">
							Analysis
						</Heading>
						<Card>
							<Code>
								<pre style={{ whiteSpace: 'pre-wrap' }}>{summary.text.value}</pre>
							</Code>
						</Card>
					</Box>
				)}

				<Box mt="4">
					<Heading size="4" mb="2">
						Changed Files
					</Heading>
					{commit.commitChanges.map((change) => (
						<Text as="p" key={change.id}>
							{change.filename}
						</Text>
					))}
				</Box>
			</Card>
		</Container>
	);
}
