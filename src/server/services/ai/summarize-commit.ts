import 'dotenv/config';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';
import { z } from 'zod';
import { GithubCommitType } from '@/server/db/schema/github';

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
- If the commit it a dependency update, focus on which were updated and their relevance to the project.

</style-rules>`;

export const summarizeCommit = async (commit: CommitSummaryInput) => {
	const completion = await openai.beta.chat.completions.parse({
		model: 'gpt-4o',
		response_format: zodResponseFormat(CommitSummaryResponseSchema, 'commit_summary'),
		messages: [
			{ role: 'system', content: commitSummarizerInstructions },
			{ role: 'user', content: JSON.stringify(commit) },
		],
	});

	const firstChoice = completion.choices[0];
	if (!firstChoice?.message.parsed) {
		throw new Error('No response from OpenAI');
	}

	const summary = firstChoice.message.parsed;

	return summary;
};
