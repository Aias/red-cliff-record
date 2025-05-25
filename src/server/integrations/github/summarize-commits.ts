import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod/v4'; // TODO: Update to v4 when OpenAI supports it
import { db } from '@/server/db/connections';
import type {
	GithubCommitChangeSelect,
	GithubCommitSelect,
	GithubRepositorySelect,
} from '@/server/db/schema/github';
import { githubCommits, GithubCommitType } from '@/server/db/schema/github';

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

export type CommitSummaryInput = z.infer<typeof CommitSummaryInputSchema>;

export const CommitSummaryResponseSchema = z.object({
	primary_purpose: GithubCommitType.describe(
		'The primary purpose of the commit based on conventional commit types.'
	),
	summary: z
		.string()
		.describe(
			'A markdown-formatted summary of the github commit according to the given instructions.'
		),
	technologies: z
		.array(z.string())
		.describe(
			'An array of strings which represent relevant tools, technologies, packages, languages, frameworks, etc.'
		),
});

export type CommitSummaryResponse = z.infer<typeof CommitSummaryResponseSchema>;

export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export const commitSummarizerInstructions = `
<assistant-notes>

You are an expert programmer who cares deeply about communicating the intent and content of your new and changed code. Your job is to evaluate a Github commit and create documentation consisting of three main parts:

1. The primary purpose of the commit, which is a single or two words that describe the primary purpose of the commit. E.g.: New Feature, Bug Fix, Refactoring, Dependency Update, etc.
2. A brief summary of the commit, which covers _what_ has changed, as well as the functional relevance of those changes in-context.
3. A list of relevant tools, technologies, languages, libraries, packages, or frameworks used or relied on in the code.

</assistant-notes>

<input>

You will be given the following as input:

- The full commit itself, including a list of files changed and up to 2048 characters of each patch
- A summary of the repository the commit was made to
- (Optionally) up to three previous summaries of commits prior to this one.

</input>

<style-rules>

- For the *commit summary*, use markdown formatting, but do not use headings. Primarily use paragraphs, but ordered / unordered lists, and inline formatting syntax are allowed where appropriate. Avoid code blocks.
- If only one or two files have changed, list the specific files in the commit summary. If more than two files have changed, do not attempt to list them all.
- For *tools and technologies*, use the common name of the tool, technology, package, or framework, with correct capitalization and spacing. List up to 10 in order of relevance. Do not include lockfile updates unless also included in changes to package.json.
- If the commit is a refactoring, focus on the intent of the refactoring and the functional relevance of the changes.
- If the commit is a bug fix, focus on the intent of the fix and the functional relevance of the changes.
- If the commit is a new feature, focus on the intent of the feature and the functional relevance of the changes.
- If the commit is a dependency update, focus on which were updated and their relevance to the project.

</style-rules>`;

export const summarizeCommit = async (
	commit: CommitSummaryInput
): Promise<CommitSummaryResponse> => {
	const response = await openai.responses.create({
		model: 'gpt-4.1',
		instructions: commitSummarizerInstructions,
		text: {
			format: {
				type: 'json_schema',
				name: 'commit_summary',
				schema: z.toJSONSchema(CommitSummaryResponseSchema),
				strict: true,
			},
		},
		input: [{ role: 'user', content: JSON.stringify(commit) }],
	});

	const summaryJson = JSON.parse(response.output_text);
	const summary = CommitSummaryResponseSchema.parse(summaryJson);

	return summary;
};

type CommitWithRelations = GithubCommitSelect & {
	repository: GithubRepositorySelect;
	commitChanges: GithubCommitChangeSelect[];
};

const BATCH_SIZE = 20;

async function getCommitsWithoutSummaries() {
	const commits = await db.query.githubCommits.findMany({
		with: {
			repository: {
				columns: {
					fullName: true,
					description: true,
					language: true,
					topics: true,
					licenseName: true,
				},
			},
			commitChanges: {
				columns: {
					filename: true,
					status: true,
					changes: true,
					deletions: true,
					additions: true,
					patch: true,
				},
			},
		},
		where: {
			summary: {
				isNull: true,
			},
		},
		orderBy: {
			committedAt: 'asc',
		},
	});

	return commits as unknown as CommitWithRelations[];
}

async function processBatch(
	commits: CommitWithRelations[],
	batchNumber: number,
	totalCommits: number
) {
	const results = await Promise.allSettled(
		commits.map(async (commit, index) => {
			try {
				const remainingBatches = Math.ceil((totalCommits - batchNumber * BATCH_SIZE) / BATCH_SIZE);
				console.log(
					`\nBatch ${batchNumber + 1} (${remainingBatches} batches remaining) - Commit ${index + 1}/${commits.length}`,
					`\nStarting summarization for commit ${commit.sha.slice(0, 7)}:`,
					`\n  Repository: ${commit.repository.fullName}`,
					`\n  Message: ${commit.message.split('\n')[0]}`
				);

				const summary = await summarizeCommit({
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
				});

				console.log(
					`Completed summarization for commit ${commit.sha.slice(0, 7)}:`,
					`\n  Type: ${summary.primary_purpose}`,
					`\n  Summary: ${summary.summary.slice(0, 100)}${summary.summary.length > 100 ? '...' : ''}`
				);

				await db
					.update(githubCommits)
					.set({
						summary: summary.summary,
						commitType: summary.primary_purpose,
						technologies: summary.technologies,
					})
					.where(eq(githubCommits.sha, commit.sha));

				return { success: true, sha: commit.sha };
			} catch (error) {
				console.error(`Failed to summarize commit ${commit.sha}:`, error);
				return { success: false, sha: commit.sha, error };
			}
		})
	);

	return results;
}

export async function syncCommitSummaries(): Promise<number> {
	let totalProcessed = 0;
	let commits;
	let batchNumber = 0;

	commits = await getCommitsWithoutSummaries();
	const totalCommits = commits.length;
	console.log(
		`\nStarting summarization of ${totalCommits} commits in ${Math.ceil(totalCommits / BATCH_SIZE)} batches\n`
	);

	do {
		const batch = commits.slice(0, BATCH_SIZE);

		if (batch.length === 0) break;

		const results = await processBatch(batch, batchNumber, totalCommits);
		const successful = results.filter(
			(result) => result.status === 'fulfilled' && result.value.success
		).length;

		totalProcessed += successful;

		console.log(
			`\nCompleted batch ${batchNumber + 1} of ${Math.ceil(totalCommits / BATCH_SIZE)}:`,
			`\n  Processed ${batch.length} commits, ${successful} successful`,
			`\n  Total processed so far: ${totalProcessed}/${totalCommits}`
		);

		batchNumber++;
		commits = await getCommitsWithoutSummaries();
	} while (commits.length >= BATCH_SIZE);

	console.log(
		`\nFinished processing all commits. Total successful: ${totalProcessed}/${totalCommits}`
	);
	return totalProcessed;
}
