import { z } from 'zod';
import { GithubCommitType } from '~/server/db/schema/github';

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
