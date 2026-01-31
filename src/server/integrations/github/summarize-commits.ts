import {
  githubCommits,
  GithubCommitType,
  type GithubCommitChangeSelect,
  type GithubCommitSelect,
  type GithubRepositorySelect,
} from '@hozo';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { z } from 'zod';
import { db } from '@/server/db/connections';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createIntegrationLogger } from '../common/logging';

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

Your job is to evaluate a Github commit and create documentation consisting of three main parts:

1. The primary purpose of the commit, which is a single word or two words that describe the primary purpose of the commit. E.g.: New Feature, Bug Fix, Refactoring, Dependency Update, etc.
2. A brief summary of the commit, which covers *what* has changed, as well as the *functional relevance* of those changes in-context.
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
    model: 'gpt-5.2',
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

const logger = createIntegrationLogger('github', 'summarize-commits');

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

async function processCommit(
  commit: CommitWithRelations
): Promise<{ success: boolean; sha: string }> {
  try {
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

    await db
      .update(githubCommits)
      .set({
        summary: summary.summary,
        commitType: summary.primary_purpose,
        technologies: summary.technologies,
      })
      .where(eq(githubCommits.sha, commit.sha));

    logger.info(
      `[${commit.sha.slice(0, 7)}] ${commit.repository.fullName}: ${summary.primary_purpose}`
    );

    return { success: true, sha: commit.sha };
  } catch (error) {
    logger.error(`[${commit.sha.slice(0, 7)}] Failed`, error);
    return { success: false, sha: commit.sha };
  }
}

export async function syncCommitSummaries(): Promise<number> {
  const commits = await getCommitsWithoutSummaries();

  if (commits.length === 0) {
    logger.skip('No commits to summarize');
    return 0;
  }

  logger.start(`Starting summarization of ${commits.length} commits (concurrency: 20)`);

  const results = await runConcurrentPool({
    items: commits,
    concurrency: 20,
    worker: async (commit) => processCommit(commit),
    onProgress: (completed, total) => {
      if (completed % 20 === 0 || completed === total) {
        logger.info(`Progress: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
      }
    },
  });

  const successful = results.filter((r) => r.ok && r.value.success).length;
  logger.complete(`Finished summarizing commits (${successful}/${commits.length} successful)`);

  return successful;
}
