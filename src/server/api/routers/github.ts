import { TRPCError } from '@trpc/server';
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { githubCommits, githubRepositories, githubUsers } from '~/server/db/schema/github';
import { recordCreators } from '~/server/db/schema/records';
import { summarizeCommit } from '~/server/services/ai/summarize-commit';
import { createTRPCRouter, publicProcedure } from '../init';
import { buildWhereClause, RequestParamsSchema, similarity } from './common';
import { CommitSummaryInputSchema } from './github.types';

export const githubRouter = createTRPCRouter({
	getCommits: publicProcedure.input(RequestParamsSchema).query(({ ctx: { db }, input }) => {
		return db.query.githubCommits.findMany({
			columns: {
				embedding: false,
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
					columns: { embedding: true },
				});

				if (!sourceCommit?.embedding) {
					return [];
				}

				const relatedCommits = await db.query.githubCommits.findMany({
					columns: {
						embedding: false,
					},
					with: {
						repository: true,
						commitChanges: true,
					},
					extras: {
						similarity: similarity(githubCommits.embedding, sourceCommit.embedding),
					},
					where: and(ne(githubCommits.id, commitId), isNotNull(githubCommits.embedding)),
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

	getRepositories: publicProcedure
		.input(RequestParamsSchema)
		.query(async ({ ctx: { db }, input }) => {
			const stars = await db.query.githubRepositories.findMany({
				columns: {
					embedding: false,
				},
				with: {
					owner: {
						columns: {
							embedding: false,
						},
					},
				},
				where: buildWhereClause(input, githubRepositories.archivedAt, githubRepositories.recordId, [
					or(isNotNull(githubRepositories.starredAt), eq(githubRepositories.private, false)) ??
						sql`true`,
				]),
				orderBy: [
					desc(githubRepositories.archivedAt),
					desc(githubRepositories.starredAt),
					githubRepositories.contentCreatedAt,
					githubRepositories.createdAt,
				],
				limit: input.limit,
			});

			return stars.map((star) => ({ ...star, embedding: null }));
		}),

	linkRepositoryToRecord: publicProcedure
		.input(
			z.object({ repositoryId: z.number().int().positive(), recordId: z.number().int().positive() })
		)
		.mutation(async ({ ctx: { db }, input: { repositoryId, recordId } }) => {
			const result = await db.transaction(async (tx) => {
				const [updatedRepository] = await tx
					.update(githubRepositories)
					.set({ recordId })
					.where(eq(githubRepositories.id, repositoryId))
					.returning();
				if (!updatedRepository) {
					throw new Error('Failed to link repository to record');
				}

				const owner = await tx.query.githubUsers.findFirst({
					where: eq(githubUsers.id, updatedRepository.ownerId),
					columns: {
						id: true,
						indexEntryId: true,
					},
				});
				if (owner?.indexEntryId && updatedRepository.recordId) {
					await tx
						.insert(recordCreators)
						.values({
							recordId: updatedRepository.recordId,
							entityId: owner.indexEntryId,
							role: 'creator',
						})
						.onConflictDoNothing();
				}

				return updatedRepository;
			});
			return result;
		}),

	unlinkRepositoriesFromRecords: publicProcedure
		.input(z.array(z.number().int().positive()))
		.mutation(async ({ ctx: { db }, input: repositoryIds }) => {
			console.log(`Unlinking ${repositoryIds.length} repositories from records...`);
			const result = await db.transaction(async (tx) => {
				// Fetch repositories to get their current recordId values before unlinking.
				const repositories = await tx.query.githubRepositories.findMany({
					where: inArray(githubRepositories.id, repositoryIds),
					with: {
						record: {
							columns: {
								id: true,
							},
							with: {
								recordCreators: {
									columns: {
										id: true,
									},
								},
							},
						},
					},
					columns: {
						id: true,
						recordId: true,
					},
				});
				console.log(`Found ${repositories.length} repositories to unlink`);

				const recordCreatorsToDelete = repositories
					.flatMap((repo) => repo.record?.recordCreators.map((recordCreator) => recordCreator.id))
					.filter((id): id is number => id !== undefined);

				console.log(
					`Found ${recordCreatorsToDelete.length} record creators to delete`,
					recordCreatorsToDelete
				);

				if (recordCreatorsToDelete.length > 0) {
					await tx.delete(recordCreators).where(inArray(recordCreators.id, recordCreatorsToDelete));
					console.log('Deleted record creators');
				}

				// Unlink repositories from records.
				const updatedRepos = await tx
					.update(githubRepositories)
					.set({ recordId: null })
					.where(inArray(githubRepositories.id, repositoryIds))
					.returning();

				console.log(`Successfully unlinked ${updatedRepos.length} repositories`);
				return updatedRepos;
			});
			return result;
		}),

	setRepositoriesArchiveStatus: publicProcedure
		.input(
			z.object({ repositoryIds: z.array(z.number().int().positive()), shouldArchive: z.boolean() })
		)
		.mutation(async ({ ctx: { db }, input: { repositoryIds, shouldArchive } }) => {
			return db
				.update(githubRepositories)
				.set({ archivedAt: shouldArchive ? new Date() : null })
				.where(inArray(githubRepositories.id, repositoryIds))
				.returning();
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
