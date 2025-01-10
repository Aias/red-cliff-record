import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/start';
import { desc, eq, ilike, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/connections';
import { airtableSpaces, AirtableSpaceSelectSchema } from '@/db/schema/integrations';
import { indices, IndicesSelectSchema } from '@/db/schema/main';

export const getAirtableSpaces = createServerFn({ method: 'GET' }).handler(async () => {
	const spaces = await db.query.airtableSpaces.findMany({
		with: {
			indexEntry: true,
		},
		limit: 100,
		orderBy: [
			desc(airtableSpaces.archivedAt),
			airtableSpaces.contentCreatedAt,
			airtableSpaces.name,
		],
	});
	return spaces;
});

export const airtableSpaceQueryOptions = () =>
	queryOptions({
		queryKey: ['airtableSpaces'],
		queryFn: () => getAirtableSpaces(),
	});

const getArchiveQueueLength = createServerFn({ method: 'GET' }).handler(async () => {
	const count = await db.$count(airtableSpaces, isNull(airtableSpaces.archivedAt));
	return count;
});

export const archiveQueueLengthQueryOptions = () =>
	queryOptions({
		queryKey: ['archiveQueueLength'],
		queryFn: () => getArchiveQueueLength(),
	});

export const fetchSpaceById = createServerFn({ method: 'GET' })
	.validator(z.string())
	.handler(async ({ data: airtableId }) => {
		const space = await db.query.airtableSpaces.findFirst({
			where: eq(airtableSpaces.id, airtableId),
			with: {
				indexEntry: true,
			},
		});

		if (!space) {
			throw new Error('Record not found');
		}

		return space;
	});

export const airtableSpaceByIdQueryOptions = (airtableId: string) =>
	queryOptions({
		queryKey: ['airtableSpaceById', airtableId],
		queryFn: () => fetchSpaceById({ data: airtableId }),
	});

export const createOrUpdateIndexEntry = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			name: z.string(),
			existingIndexEntryId: z.number().int().positive().nullable(),
			createdAt: z.date(),
			updatedAt: z.date(),
		})
	)
	.handler(async ({ data }) => {
		const { existingIndexEntryId, ...values } = data;
		const titleCaseName = values.name.replace(/\b\w/g, (char) => char.toUpperCase());

		if (existingIndexEntryId) {
			const [indexEntry] = await db
				.update(indices)
				.set({ ...values, name: titleCaseName })
				.where(eq(indices.id, existingIndexEntryId))
				.returning();
			return indexEntry;
		}

		const [indexEntry] = await db
			.insert(indices)
			.values({ ...values, name: titleCaseName, mainType: 'category' as const })
			.returning();
		return indexEntry;
	});

export const linkSpaceToIndexEntry = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			spaceId: z.string(),
			indexEntryId: z.number().int().positive(),
		})
	)
	.handler(async ({ data }) => {
		const [updatedSpace] = await db
			.update(airtableSpaces)
			.set({
				indexEntryId: data.indexEntryId,
				updatedAt: new Date(),
			})
			.where(eq(airtableSpaces.id, data.spaceId))
			.returning();
		return updatedSpace;
	});

export const createIndexEntryFromAirtableSpace = createServerFn({ method: 'POST' })
	.validator(AirtableSpaceSelectSchema)
	.handler(async ({ data: space }) => {
		const indexEntry = await createOrUpdateIndexEntry({
			data: {
				name: space.name,
				existingIndexEntryId: space.indexEntryId,
				createdAt: space.contentCreatedAt ?? space.createdAt,
				updatedAt: space.contentUpdatedAt ?? space.updatedAt,
			},
		});

		const airtableSpace = await linkSpaceToIndexEntry({
			data: {
				spaceId: space.id,
				indexEntryId: indexEntry.id,
			},
		});

		return { indexEntry, airtableSpace };
	});

export const createIndexEntries = createServerFn({ method: 'POST' })
	.validator(z.array(AirtableSpaceSelectSchema))
	.handler(async ({ data }) => {
		const newEntries = await Promise.all(
			data.map((space) => createIndexEntryFromAirtableSpace({ data: space }))
		);
		return newEntries;
	});

export const unlinkIndexEntries = createServerFn({ method: 'POST' })
	.validator(z.array(z.string()))
	.handler(async ({ data: ids }) => {
		const [space] = await db
			.update(airtableSpaces)
			.set({ indexEntryId: null, archivedAt: null, updatedAt: new Date() })
			.where(inArray(airtableSpaces.id, ids))
			.returning();
		return space;
	});

const SetSpaceArchiveStatusSchema = z.object({
	ids: z.array(z.string()),
	shouldArchive: z.boolean().default(true),
});

export const setSpaceArchiveStatus = createServerFn({ method: 'POST' })
	.validator(SetSpaceArchiveStatusSchema)
	.handler(async ({ data: { ids, shouldArchive } }) => {
		await db
			.update(airtableSpaces)
			.set({
				archivedAt: shouldArchive ? new Date() : null,
				updatedAt: new Date(),
			})
			.where(inArray(airtableSpaces.id, ids));
	});

export const updateIndexEntry = createServerFn({ method: 'POST' })
	.validator(IndicesSelectSchema)
	.handler(async ({ data }) => {
		const { id, ...values } = data;

		const [updatedEntry] = await db
			.update(indices)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(indices.id, id))
			.returning();

		return updatedEntry;
	});

export const getRelatedIndices = createServerFn({ method: 'GET' })
	.validator(z.string())
	.handler(async ({ data: searchString }) => {
		const results = await db.query.indices.findMany({
			where: ilike(indices.name, `%${searchString}%`),
			limit: 10,
			orderBy: desc(indices.updatedAt),
		});

		return results;
	});

export const relatedIndicesQueryOptions = (searchString: string) =>
	queryOptions({
		queryKey: ['relatedIndices', searchString],
		queryFn: () => getRelatedIndices({ data: searchString }),
	});
