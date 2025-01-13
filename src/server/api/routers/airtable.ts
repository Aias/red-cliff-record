import { desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { airtableSpaces } from '~/server/db/schema/integrations';
import { createTRPCRouter, publicProcedure } from '../init';

export const airtableRouter = createTRPCRouter({
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

	getArchiveQueueLength: publicProcedure.query(({ ctx: { db } }) => {
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

	setSpaceArchiveStatus: publicProcedure
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
