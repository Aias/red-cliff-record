import { z } from 'zod';
import { GithubCommitType } from '@/db/schema/integrations/github';

export const CommitSummarySchema = z.object({
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

export type CommitSummary = z.infer<typeof CommitSummarySchema>;
