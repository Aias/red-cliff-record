import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { githubCommits, githubRepositories, githubUsers } from '~/server/db/schema/integrations';
import { embeddings } from '~/server/db/schema/main';
import { summarizeCommit } from '~/server/services/ai/summarize-commit';
import { createTRPCRouter, publicProcedure } from '../init';
import { buildWhereClause, RequestParamsSchema } from './common';
import { CommitSummaryInputSchema } from './github.types';

export const githubRouter = createTRPCRouter({
	getCommits: publicProcedure.input(RequestParamsSchema).query(({ ctx: { db }, input }) => {
		return db.query.githubCommits.findMany({
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
				const relatedCommits = await db.query.githubCommits.findMany({
					with: {
						repository: true,
						commitChanges: true,
						embedding: true,
					},
					extras: {
						similarity: sql<number>`
							1 - (
								SELECT (e1.embedding <=> e2.embedding)
								FROM ${embeddings} e1, ${embeddings} e2
								JOIN ${githubCommits} gc ON e2.id = gc.embedding_id
								WHERE e1.id = ${githubCommits.embeddingId}
								AND gc.id = ${commitId}
							)
						`.as('similarity'),
					},
					where: and(ne(githubCommits.id, commitId), isNotNull(githubCommits.embeddingId)),
					orderBy: (_commits, { desc }) => [desc(sql`similarity`)],
					limit: 10,
				});

				return relatedCommits;
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

	getStars: publicProcedure.input(RequestParamsSchema).query(async ({ ctx: { db }, input }) => {
		const stars = await db.query.githubRepositories.findMany({
			with: {
				owner: true,
			},
			where: buildWhereClause(input, githubRepositories.archivedAt, githubRepositories.recordId, [
				isNotNull(githubRepositories.starredAt),
			]),
			orderBy: [desc(githubRepositories.archivedAt), desc(githubRepositories.starredAt)],
			limit: input.limit,
		});

		return stars;
	}),

	getUsers: publicProcedure.input(RequestParamsSchema).query(async ({ ctx: { db }, input }) => {
		const users = await db.query.githubUsers.findMany({
			with: {
				repositories: true,
			},
			where: buildWhereClause(input, githubUsers.archivedAt, githubUsers.indexEntryId),
			orderBy: [desc(githubUsers.archivedAt), desc(githubUsers.contentCreatedAt)],
			limit: input.limit,
		});
		return users;
	}),

	linkUserToIndexEntry: publicProcedure
		.input(
			z.object({ userId: z.number().int().positive(), indexEntryId: z.number().int().positive() })
		)
		.mutation(async ({ ctx: { db }, input: { userId, indexEntryId } }) => {
			const [updatedUser] = await db
				.update(githubUsers)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(githubUsers.id, userId))
				.returning();
			return updatedUser;
		}),

	unlinkUsersFromIndices: publicProcedure
		.input(z.array(z.number().int().positive()))
		.mutation(async ({ ctx: { db }, input: userIds }) => {
			return db
				.update(githubUsers)
				.set({ indexEntryId: null, updatedAt: new Date() })
				.where(inArray(githubUsers.id, userIds))
				.returning();
		}),

	setUsersArchiveStatus: publicProcedure
		.input(z.object({ userIds: z.array(z.number().int().positive()), shouldArchive: z.boolean() }))
		.mutation(async ({ ctx: { db }, input: { userIds, shouldArchive } }) => {
			return db
				.update(githubUsers)
				.set({ archivedAt: shouldArchive ? new Date() : null })
				.where(inArray(githubUsers.id, userIds))
				.returning();
		}),
});
