import { githubCommits, GithubCommitTypeSchema } from '@hozo';
import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getOpenAIClient, OPENAI_MODEL } from '@/server/lib/openai';
import { Database } from '../runtime/db';
import { ApiRequestError } from '../runtime/errors';
import { forEachCollect, type ItemFailure } from '../runtime/run';

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
  primary_purpose: GithubCommitTypeSchema.describe(
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
  const response = await getOpenAIClient().responses.parse({
    model: OPENAI_MODEL,
    instructions: commitSummarizerInstructions,
    text: {
      format: zodTextFormat(CommitSummaryResponseSchema, 'commit_summary'),
    },
    input: [{ type: 'message', role: 'user', content: JSON.stringify(commit) }],
  });

  if (!response.output_parsed) {
    const reason = response.incomplete_details?.reason ?? response.status ?? 'no output';
    throw new Error(`Commit summary response could not be parsed (${reason})`);
  }

  return response.output_parsed;
};

const SUMMARY_CONCURRENCY = 20;

export const summarizeMissingCommits = Effect.gen(function* () {
  const database = yield* Database;
  const commits = yield* database.use('githubCommits.withoutSummaries', (client) =>
    client.query.githubCommits.findMany({
      with: { repository: true, commitChanges: true },
      where: { summary: { isNull: true } },
      orderBy: { committedAt: 'asc' },
    })
  );
  if (commits.length === 0) {
    yield* Effect.logInfo('No commits to summarize');
    return { summarized: 0, failures: [] as Array<ItemFailure> };
  }
  yield* Effect.logInfo(`Summarizing ${commits.length} commits`);
  const results = yield* forEachCollect(commits, {
    concurrency: SUMMARY_CONCURRENCY,
    label: (commit) => commit.sha.slice(0, 7),
    worker: (commit) =>
      Effect.gen(function* () {
        const repository = commit.repository;
        if (!repository) {
          return yield* Effect.fail(
            new ApiRequestError({
              resource: `github commit ${commit.sha.slice(0, 7)}`,
              cause: 'no repository',
            })
          );
        }
        const summary = yield* Effect.tryPromise({
          try: () =>
            summarizeCommit({
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
                fullName: repository.fullName,
                description: repository.description,
                language: repository.language,
                topics: repository.topics,
                licenseName: repository.licenseName,
              },
            }),
          catch: (cause) =>
            new ApiRequestError({ resource: `summarize ${commit.sha.slice(0, 7)}`, cause }),
        });
        yield* database.use(`githubCommits.summary:${commit.sha.slice(0, 7)}`, (client) =>
          client
            .update(githubCommits)
            .set({
              summary: summary.summary,
              commitType: summary.primary_purpose,
              technologies: summary.technologies,
            })
            .where(eq(githubCommits.sha, commit.sha))
        );
      }),
  });
  yield* Effect.logInfo(`Summarized ${results.successes.length} of ${commits.length} commits`);
  return { summarized: results.successes.length, failures: results.failures };
});
