import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/start';
import { isNull, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/connections';
import { airtableSpaces, AirtableSpaceSelectSchema } from '@/db/schema/integrations';
import { indexEntries, IndexEntrySelectSchema } from '@/db/schema/main';
import { z } from 'zod';

export const getAirtableSpaces = createServerFn({ method: 'GET' }).handler(async () => {
	const spaces = await db.query.airtableSpaces.findMany({
		with: {
			indexEntry: true,
		},
		where: isNull(airtableSpaces.archivedAt),
		limit: 100,
		orderBy: [airtableSpaces.contentCreatedAt, airtableSpaces.name],
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

export const createIndexEntryFromAirtableSpace = createServerFn({ method: 'POST' })
	.validator(AirtableSpaceSelectSchema)
	.handler(async ({ data }) => {
		const { id, name, contentCreatedAt, contentUpdatedAt, createdAt, updatedAt, indexEntryId } =
			data;

		const titleCaseName = name.replace(/\b\w/g, (char) => char.toUpperCase());

		const values = {
			name: titleCaseName,
			mainType: 'category' as const,
			createdAt: contentCreatedAt ?? createdAt,
			updatedAt: contentUpdatedAt ?? updatedAt,
		};

		let indexEntry;
		let airtableSpace = data;
		if (indexEntryId) {
			// Update existing entry
			[indexEntry] = await db
				.update(indexEntries)
				.set(values)
				.where(eq(indexEntries.id, indexEntryId))
				.returning();
		} else {
			// Create new entry
			[indexEntry] = await db.insert(indexEntries).values(values).returning();

			// Link the new entry to the airtable space
			[airtableSpace] = await db
				.update(airtableSpaces)
				.set({
					indexEntryId: indexEntry.id,
					updatedAt: new Date(),
				})
				.where(eq(airtableSpaces.id, id))
				.returning();
		}

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

export const archiveSpaces = createServerFn({ method: 'POST' })
	.validator(z.array(z.string()))
	.handler(async ({ data: spaceIds }) => {
		await db
			.update(airtableSpaces)
			.set({ archivedAt: new Date() })
			.where(inArray(airtableSpaces.id, spaceIds));
	});

export const updateIndexEntry = createServerFn({ method: 'POST' })
	.validator(IndexEntrySelectSchema)
	.handler(async ({ data }) => {
		const { id, ...values } = data;

		const [updatedEntry] = await db
			.update(indexEntries)
			.set({ ...values, updatedAt: new Date() })
			.where(eq(indexEntries.id, id))
			.returning();

		return updatedEntry;
	});
