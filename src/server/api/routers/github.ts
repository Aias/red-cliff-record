import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { githubCommits } from '~/server/db/schema/integrations';
import { summarizeCommit } from '~/server/services/ai/summarize-commit';
import { createTRPCRouter, publicProcedure } from '../init';
import { CommitSummaryInputSchema } from './github.types';

export const githubRouter = createTRPCRouter({
	getCommits: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.githubCommits.findMany({
			with: {
				repository: true,
				commitChanges: true,
			},
			orderBy: [desc(githubCommits.committedAt)],
			limit: 50,
		});
	}),

	getCommitBySha: publicProcedure.input(z.string()).query(async ({ ctx: { db }, input }) => {
		const commit = await db.query.githubCommits.findFirst({
			where: eq(githubCommits.sha, input),
			with: {
				repository: true,
				commitChanges: true,
			},
		});

		if (!commit) {
			throw new Error('Commit not found');
		}

		return commit;
	}),

	batchSummarize: publicProcedure
		.input(z.array(CommitSummaryInputSchema))
		.mutation(async ({ ctx: { db }, input }) => {
			try {
				const summaries = await Promise.all(
					input.map(async (commitInput) => {
						const summary = await summarizeCommit(JSON.stringify(commitInput));

						await db
							.update(githubCommits)
							.set({
								commitType: summary.primary_purpose,
								summary: summary.summary,
								technologies: summary.technologies,
							})
							.where(eq(githubCommits.sha, commitInput.sha));

						return { sha: commitInput.sha, summary };
					})
				);

				return summaries;
			} catch (error) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to summarize commits',
					cause: error,
				});
			}
		}),
});
