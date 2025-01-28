import { desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtracts,
	airtableSpaces,
} from '~/server/db/schema/integrations';
import { createTRPCRouter, mergeRouters, publicProcedure } from '../init';
import { DEFAULT_LIMIT } from './common';

const spacesRouter = createTRPCRouter({
	getSpaces: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.airtableSpaces.findMany({
			with: {
				indexEntry: true,
			},
			limit: DEFAULT_LIMIT,
			where: isNull(airtableSpaces.indexEntryId),
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
		.mutation(async ({ ctx: { db }, input: { spaceId, indexEntryId } }) => {
			const [updatedSpace] = await db
				.update(airtableSpaces)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(airtableSpaces.id, spaceId))
				.returning();
			return updatedSpace;
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
	getCreators: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.airtableCreators.findMany({
			with: {
				indexEntry: true,
			},
			limit: DEFAULT_LIMIT,
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
		.mutation(async ({ ctx: { db }, input: { creatorId, indexEntryId } }) => {
			const [updatedCreator] = await db
				.update(airtableCreators)
				.set({ indexEntryId, updatedAt: new Date() })
				.where(eq(airtableCreators.id, creatorId))
				.returning();
			return updatedCreator;
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

const extractsRouter = createTRPCRouter({
	getExtracts: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.airtableExtracts.findMany({
			where: isNull(airtableExtracts.recordId),
			orderBy: [
				desc(airtableExtracts.archivedAt),
				airtableExtracts.contentCreatedAt,
				airtableExtracts.title,
			],
			limit: DEFAULT_LIMIT,
		});
	}),
});

const attachmentsRouter = createTRPCRouter({
	getAttachments: publicProcedure.query(({ ctx: { db } }) => {
		return db.query.airtableAttachments.findMany({
			where: isNull(airtableAttachments.mediaId),
			orderBy: [
				desc(airtableAttachments.archivedAt),
				airtableAttachments.createdAt,
				airtableAttachments.filename,
			],
			limit: DEFAULT_LIMIT,
		});
	}),
});

export const airtableRouter = mergeRouters(
	spacesRouter,
	creatorsRouter,
	extractsRouter,
	attachmentsRouter
);
