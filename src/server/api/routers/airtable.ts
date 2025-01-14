import { desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { airtableCreators, airtableSpaces } from '~/server/db/schema/integrations';
import { createTRPCRouter, mergeRouters, publicProcedure } from '../init';

const spacesRouter = createTRPCRouter({
	getSpaces: publicProcedure
		.input(
			z.object({
				limit: z.number().int().positive().optional(),
			})
		)
		.query(({ ctx: { db }, input: { limit } }) => {
			return db.query.airtableSpaces.findMany({
				with: {
					indexEntry: true,
				},
				limit: limit ?? 100,
				orderBy: [
					desc(airtableSpaces.archivedAt),
					airtableSpaces.contentCreatedAt,
					airtableSpaces.name,
				],
			});
		}),

	getSpacesQueueLength: publicProcedure.query(({ ctx: { db } }) => {
		return db.$count(airtableSpaces, isNull(airtableSpaces.archivedAt));
	}),

	linkSpaceToIndexEntry: publicProcedure
		.input(
			z.object({
				spaceId: z.string(),
				indexEntryId: z.number().int().positive(),
			})
		)
		.mutation(({ ctx: { db }, input: { spaceId, indexEntryId } }) => {
			return db
				.update(airtableSpaces)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(airtableSpaces.id, spaceId))
				.returning();
		}),

	unlinkSpacesFromIndices: publicProcedure
		.input(z.array(z.string()))
		.mutation(({ ctx: { db }, input: spaceIds }) => {
			return db
				.update(airtableSpaces)
				.set({ indexEntryId: null, updatedAt: new Date() })
				.where(inArray(airtableSpaces.id, spaceIds))
				.returning();
		}),

	setSpacesArchiveStatus: publicProcedure
		.input(
			z.object({
				spaceIds: z.array(z.string()),
				shouldArchive: z.boolean(),
			})
		)
		.mutation(({ ctx: { db }, input: { spaceIds, shouldArchive } }) => {
			return db
				.update(airtableSpaces)
				.set({ archivedAt: shouldArchive ? new Date() : null })
				.where(inArray(airtableSpaces.id, spaceIds))
				.returning();
		}),
});

const creatorsRouter = createTRPCRouter({
	getCreators: publicProcedure
		.input(
			z.object({
				limit: z.number().int().positive().optional(),
			})
		)
		.query(({ ctx: { db }, input: { limit } }) => {
			return db.query.airtableCreators.findMany({
				with: {
					indexEntry: true,
				},
				limit: limit ?? 100,
				orderBy: [
					desc(airtableCreators.archivedAt),
					airtableCreators.contentCreatedAt,
					airtableCreators.name,
				],
			});
		}),

	getCreatorsQueueLength: publicProcedure.query(({ ctx: { db } }) => {
		return db.$count(airtableCreators, isNull(airtableCreators.archivedAt));
	}),

	linkCreatorToIndexEntry: publicProcedure
		.input(
			z.object({
				creatorId: z.string(),
				indexEntryId: z.number().int().positive(),
			})
		)
		.mutation(({ ctx: { db }, input: { creatorId, indexEntryId } }) => {
			return db
				.update(airtableCreators)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(airtableCreators.id, creatorId))
				.returning();
		}),

	unlinkCreatorsFromIndices: publicProcedure
		.input(z.array(z.string()))
		.mutation(({ ctx: { db }, input: creatorIds }) => {
			return db
				.update(airtableCreators)
				.set({ indexEntryId: null, updatedAt: new Date() })
				.where(inArray(airtableCreators.id, creatorIds))
				.returning();
		}),

	setCreatorsArchiveStatus: publicProcedure
		.input(
			z.object({
				creatorIds: z.array(z.string()),
				shouldArchive: z.boolean(),
			})
		)
		.mutation(({ ctx: { db }, input: { creatorIds, shouldArchive } }) => {
			return db
				.update(airtableCreators)
				.set({ archivedAt: shouldArchive ? new Date() : null })
				.where(inArray(airtableCreators.id, creatorIds))
				.returning();
		}),
});

export const airtableRouter = mergeRouters(spacesRouter, creatorsRouter);
