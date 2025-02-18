import { and, desc, eq, ilike, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtractConnections,
	airtableExtractCreators,
	airtableExtracts,
	airtableExtractSpaces,
	airtableFormats,
	airtableSpaces,
	type AirtableAttachmentInsert,
	type AirtableCreatorInsert,
	type AirtableExtractConnectionInsert,
	type AirtableExtractCreatorInsert,
	type AirtableExtractInsert,
	type AirtableExtractSpaceInsert,
	type AirtableFormatInsert,
	type AirtableSpaceInsert,
} from '@/server/db/schema/airtable';
import { deleteMediaFromR2 } from '../common/media-helpers';
import { runIntegration } from '../common/run-integration';
import { airtableBase, storeMedia } from './helpers';
import {
	createCategoriesFromAirtableSpaces,
	createConnectionsBetweenRecords,
	createEntitiesFromAirtableCreators,
	createFormatsFromAirtableFormats,
	createMediaFromAirtableAttachments,
	createRecordsFromAirtableExtracts,
} from './map';
import { CreatorFieldSetSchema, ExtractFieldSetSchema, SpaceFieldSetSchema } from './types';

async function cleanupExistingRecords() {
	console.log('Cleaning up existing Airtable records...');

	// First, get all attachments with R2 URLs that need to be deleted
	console.log(`Deleting attachments from R2 bucket.`);
	const attachmentsToDelete = await db.query.airtableAttachments.findMany({
		where: ilike(airtableAttachments.url, `%${process.env.ASSETS_DOMAIN}%`),
	});

	if (attachmentsToDelete.length > 0) {
		console.log(`Found ${attachmentsToDelete.length} R2 assets to delete`);

		// Process in batches of 50
		const BATCH_SIZE = 50;
		for (let i = 0; i < attachmentsToDelete.length; i += BATCH_SIZE) {
			const batch = attachmentsToDelete.slice(i, i + BATCH_SIZE);
			console.log(
				`Processing deletion batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
					attachmentsToDelete.length / BATCH_SIZE
				)}`
			);

			await Promise.all(
				batch.map(async (attachment) => {
					try {
						// Extract the asset ID from the URL
						const url = new URL(attachment.url);
						const assetId = url.pathname.slice(1); // Remove leading slash
						await deleteMediaFromR2(assetId);
						console.log(`Deleted R2 asset: ${assetId}`);
					} catch (error) {
						console.error('Failed to delete R2 asset:', {
							attachmentId: attachment.id,
							url: attachment.url,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				})
			);

			// Add a small delay between batches to prevent rate limiting
			if (i + BATCH_SIZE < attachmentsToDelete.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	// Then proceed with database cleanup in correct order to maintain referential integrity
	await db.transaction(async (tx) => {
		await tx.delete(airtableExtractConnections);
		await tx.delete(airtableExtractSpaces);
		await tx.delete(airtableExtractCreators);
		await tx.delete(airtableAttachments);
		await tx.delete(airtableExtracts);
		await tx.delete(airtableSpaces);
		await tx.delete(airtableCreators);
	});

	console.log('Cleanup complete');
}

async function syncCreators(integrationRunId: number) {
	console.log('Syncing creators...');
	const lastUpdatedCreator = await db.query.airtableCreators.findFirst({
		orderBy: desc(airtableCreators.contentUpdatedAt),
		where: isNotNull(airtableCreators.contentUpdatedAt),
	});
	const lastUpdatedTime = lastUpdatedCreator?.contentUpdatedAt;
	console.log(`Last updated creator: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

	console.log(
		`Filter formula: ${lastUpdatedTime ? `lastUpdated > ${lastUpdatedTime.toISOString()}` : undefined}`
	);

	const updatedRecords = await airtableBase('Creators')
		.select({
			filterByFormula: lastUpdatedTime
				? `lastUpdated > '${lastUpdatedTime.toISOString()}'`
				: undefined,
		})
		.all();

	if (updatedRecords.length === 0) {
		console.log('No new creators to sync');
		return;
	}

	const creatorsToSync: AirtableCreatorInsert[] = updatedRecords.map((record) => {
		const fields = CreatorFieldSetSchema.parse(record.fields);
		return {
			id: record.id,
			name: fields.name,
			type: fields.type,
			primaryProject: fields.primaryProject,
			website: fields.site,
			professions: fields.professions,
			organizations: fields.organizations,
			nationalities: fields.nationality,
			contentCreatedAt: fields.createdTime,
			contentUpdatedAt: fields.lastUpdated,
			integrationRunId,
		};
	});

	console.log(`Syncing ${creatorsToSync.length} creators`, creatorsToSync);

	await db.transaction(async (tx) => {
		for (const creator of creatorsToSync) {
			console.log(`Syncing creator ${creator.name}`);
			await tx
				.insert(airtableCreators)
				.values(creator)
				.onConflictDoUpdate({
					target: [airtableCreators.id],
					set: {
						...creator,
					},
				});
		}
	});
}

async function syncSpaces(integrationRunId: number) {
	console.log('Syncing spaces...');
	const lastUpdatedSpace = await db.query.airtableSpaces.findFirst({
		orderBy: desc(airtableSpaces.contentUpdatedAt),
		where: isNotNull(airtableSpaces.contentUpdatedAt),
	});
	const lastUpdatedTime = lastUpdatedSpace?.contentUpdatedAt;
	console.log(`Last updated space: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

	const updatedRecords = await airtableBase('Spaces')
		.select({
			filterByFormula: lastUpdatedTime
				? `lastUpdated > '${lastUpdatedTime.toISOString()}'`
				: undefined,
		})
		.all();

	if (updatedRecords.length === 0) {
		console.log('No new spaces to sync');
		return;
	}

	const spacesToSync: AirtableSpaceInsert[] = updatedRecords.map((record) => {
		const fields = SpaceFieldSetSchema.parse(record.fields);
		return {
			id: record.id,
			name: fields.topic,
			fullName: fields.title,
			icon: fields.icon,
			description: fields.description,
			contentCreatedAt: fields.createdTime,
			contentUpdatedAt: fields.lastUpdated,
			integrationRunId,
		};
	});

	console.log(`Syncing ${spacesToSync.length} spaces`, spacesToSync);

	await db.transaction(async (tx) => {
		for (const space of spacesToSync) {
			console.log(`Syncing space ${space.name}`);
			await tx
				.insert(airtableSpaces)
				.values(space)
				.onConflictDoUpdate({
					target: [airtableSpaces.id],
					set: {
						...space,
					},
				});
		}
	});
}

async function syncExtracts(integrationRunId: number): Promise<{
	updatedExtractIds: string[];
}> {
	console.log('Syncing extracts...');
	const lastUpdatedExtract = await db.query.airtableExtracts.findFirst({
		orderBy: desc(airtableExtracts.contentUpdatedAt),
		where: isNotNull(airtableExtracts.contentUpdatedAt),
	});
	const lastUpdatedTime = lastUpdatedExtract?.contentUpdatedAt;
	console.log(`Last updated extract: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

	const updatedRecords = await airtableBase('Extracts')
		.select({
			filterByFormula: lastUpdatedTime
				? `lastUpdated > '${lastUpdatedTime.toISOString()}'`
				: undefined,
		})
		.all();

	if (updatedRecords.length === 0) {
		console.log('No new extracts to sync');
		return { updatedExtractIds: [] };
	}

	const parsedRecords = updatedRecords.map((record) => ({
		id: record.id,
		fields: ExtractFieldSetSchema.parse(record.fields),
	}));

	console.log(`Syncing ${parsedRecords.length} extracts`, parsedRecords);

	// First pass: Upsert extracts and attachments
	await db.transaction(async (tx) => {
		for (const record of parsedRecords) {
			const fields = record.fields;
			const newExtract: AirtableExtractInsert = {
				id: record.id,
				title: fields.title,
				formatString: fields.format,
				source: fields.source,
				michelinStars: fields.michelinStars,
				content: fields.extract,
				notes: fields.notes,
				attachmentCaption: fields.imageCaption,
				parentId: null,
				lexicographicalOrder: 'a0',
				publishedAt: fields.publishedOn,
				contentCreatedAt: fields.extractedOn,
				contentUpdatedAt: fields.lastUpdated,
				integrationRunId,
			};
			console.log(`Syncing extract ${newExtract.title}`);
			await tx
				.insert(airtableExtracts)
				.values(newExtract)
				.onConflictDoUpdate({
					target: [airtableExtracts.id],
					set: {
						...newExtract,
					},
				});
			// Link attachments
			if (fields.images) {
				for (const image of fields.images) {
					const attachment: AirtableAttachmentInsert = {
						id: image.id,
						url: image.url,
						filename: image.filename,
						size: image.size,
						width: image.width,
						height: image.height,
						type: image.type,
						extractId: record.id,
					};
					await tx
						.insert(airtableAttachments)
						.values(attachment)
						.onConflictDoUpdate({
							target: [airtableAttachments.id],
							set: {
								...attachment,
							},
						});
				}
			}
			// Link creators
			if (fields.creatorIds) {
				for (const creatorId of fields.creatorIds) {
					const link: AirtableExtractCreatorInsert = {
						extractId: record.id,
						creatorId,
					};
					await tx.insert(airtableExtractCreators).values(link).onConflictDoNothing();
				}
			}
			// Link spaces
			if (fields.spaceIds) {
				for (const spaceId of fields.spaceIds) {
					const link: AirtableExtractSpaceInsert = {
						extractId: record.id,
						spaceId,
					};
					await tx.insert(airtableExtractSpaces).values(link).onConflictDoNothing();
				}
			}
		}
	});

	// Second pass: Update parent-child relationships
	for (const record of parsedRecords) {
		const { parentId, connectionIds } = record.fields;
		if (parentId?.[0]) {
			await db
				.update(airtableExtracts)
				.set({ parentId: parentId[0] })
				.where(eq(airtableExtracts.id, record.id));
		}
		if (connectionIds) {
			for (const connectionId of connectionIds) {
				const link: AirtableExtractConnectionInsert = {
					fromExtractId: record.id,
					toExtractId: connectionId,
				};
				await db.insert(airtableExtractConnections).values(link).onConflictDoNothing();
			}
		}
	}

	return { updatedExtractIds: parsedRecords.map((record) => record.id) };
}

async function syncFormats(integrationRunId: number) {
	console.log('Syncing formats...');
	const unlinkedExtracts = await db.query.airtableExtracts.findMany({
		where: and(isNull(airtableExtracts.formatId), isNotNull(airtableExtracts.formatString)),
		orderBy: airtableExtracts.contentUpdatedAt,
	});
	if (unlinkedExtracts.length === 0) {
		console.log('No new formats to sync');
		return;
	}

	console.log(`Syncing ${unlinkedExtracts.length} formats`, unlinkedExtracts);

	await db.transaction(async (tx) => {
		for (const extract of unlinkedExtracts) {
			const format = await tx.query.airtableFormats.findFirst({
				where: eq(airtableFormats.name, extract.formatString),
			});
			if (format) {
				await tx
					.update(airtableExtracts)
					.set({ formatId: format.id })
					.where(eq(airtableExtracts.id, extract.id));
			} else {
				console.log(`Format ${extract.formatString} not found, creating new format...`);
				const formatPayload: AirtableFormatInsert = {
					name: extract.formatString,
					integrationRunId,
					recordUpdatedAt: new Date(),
				};
				const [newFormat] = await tx
					.insert(airtableFormats)
					.values(formatPayload)
					.onConflictDoUpdate({
						target: [airtableFormats.name],
						set: {
							...formatPayload,
						},
					})
					.returning();
				if (!newFormat) {
					console.error(`Failed to create new format ${extract.formatString}`);
					continue;
				}
				await tx
					.update(airtableExtracts)
					.set({ formatId: newFormat.id })
					.where(eq(airtableExtracts.id, extract.id));
			}
		}
	});
}

const CLEAR_BEFORE_SYNC = false;

async function syncAirtableData(integrationRunId: number): Promise<number> {
	if (CLEAR_BEFORE_SYNC) {
		await cleanupExistingRecords();
	}

	await syncCreators(integrationRunId);
	await syncSpaces(integrationRunId);
	const { updatedExtractIds } = await syncExtracts(integrationRunId);
	await syncFormats(integrationRunId);

	const count = await db.$count(
		airtableExtracts,
		eq(airtableExtracts.integrationRunId, integrationRunId)
	);

	const updatedMediaCount = await storeMedia();

	console.log(`Updated ${updatedMediaCount} media records`);

	await createFormatsFromAirtableFormats();
	await createEntitiesFromAirtableCreators();
	await createCategoriesFromAirtableSpaces();
	await createMediaFromAirtableAttachments();
	await createRecordsFromAirtableExtracts();
	await createConnectionsBetweenRecords(updatedExtractIds);

	return count;
}

const main = async () => {
	try {
		await runIntegration('airtable', syncAirtableData);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncAirtableData };
