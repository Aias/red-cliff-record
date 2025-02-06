import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { githubCommits } from '~/server/db/schema/github';
import { summarizeCommit } from '~/server/services/ai/summarize-commit';
import { createTRPCRouter, publicProcedure } from '../init';
import { RequestParamsSchema, similarity } from './common';
import { CommitSummaryInputSchema } from './github.types';

export const githubRouter = createTRPCRouter({
	getCommits: publicProcedure.input(RequestParamsSchema).query(({ ctx: { db }, input }) => {
		return db.query.githubCommits.findMany({
			columns: {
				textEmbedding: false,
			},
			with: {
				repository: true,
				commitChanges: true,
			},
			orderBy: [desc(githubCommits.committedAt)],
			limit: input.limit,
		});
	}),

	getRelatedCommits: publicProcedure
		.input(z.string())
		.query(async ({ ctx: { db }, input: commitId }) => {
			try {
				const sourceCommit = await db.query.githubCommits.findFirst({
					where: eq(githubCommits.id, commitId),
					columns: { textEmbedding: true },
				});

				if (!sourceCommit?.textEmbedding) {
					return [];
				}

				const relatedCommits = await db.query.githubCommits.findMany({
					columns: {
						textEmbedding: false,
					},
					with: {
						repository: true,
						commitChanges: true,
					},
					extras: {
						similarity: similarity(githubCommits.textEmbedding, sourceCommit.textEmbedding),
					},
					where: and(ne(githubCommits.id, commitId), isNotNull(githubCommits.textEmbedding)),
					orderBy: (_commits, { desc }) => [desc(sql`similarity`)],
					limit: 10,
				});

				return relatedCommits.filter((commit) => commit.similarity > 0);
			} catch (error) {
				console.error(error);
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to find related commits',
					cause: error,
				});
			}
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

	summarizeCommits: publicProcedure
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
				console.error(error);
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to summarize commits',
					cause: error,
				});
			}
		}),
});
