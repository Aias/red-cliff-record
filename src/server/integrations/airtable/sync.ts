import { eq } from 'drizzle-orm';
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
import { uploadMediaToR2 } from '@/server/lib/media';
import { runIntegration } from '../common/run-integration';
import { airtableBase, storeMedia } from './helpers';
import {
	createConnectionsBetweenRecords,
	createMediaFromAirtableAttachments,
	createRecordsFromAirtableCreators,
	createRecordsFromAirtableExtracts,
	createRecordsFromAirtableFormats,
	createRecordsFromAirtableSpaces,
} from './map';
import { CreatorFieldSetSchema, ExtractFieldSetSchema, SpaceFieldSetSchema } from './types';

/**
 * Synchronizes Airtable creators with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new or updated creators from Airtable
 * 3. Processes and stores the creators in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @throws Error if synchronization fails
 */
async function syncCreators(integrationRunId: number): Promise<void> {
	try {
		console.log('Syncing creators...');

		// Step 1: Determine last sync point
		const lastUpdatedCreator = await db.query.airtableCreators.findFirst({
			orderBy: {
				contentUpdatedAt: 'desc',
			},
			where: {
				contentUpdatedAt: {
					isNotNull: true,
				},
			},
		});
		const lastUpdatedTime = lastUpdatedCreator?.contentUpdatedAt;
		console.log(`Last updated creator: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

		// Step 2: Fetch new or updated creators
		console.log(
			`Filter formula: ${lastUpdatedTime ? `lastUpdated > ${lastUpdatedTime.toISOString()}` : 'none'}`
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

		// Step 3: Process and store creators
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

		console.log(`Syncing ${creatorsToSync.length} creators`);

		// Use a transaction to ensure all creators are synced atomically
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

		console.log(`Successfully synced ${creatorsToSync.length} creators`);
	} catch (error) {
		console.error('Error syncing creators:', error);
		throw new Error(
			`Failed to sync creators: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Synchronizes Airtable spaces with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new or updated spaces from Airtable
 * 3. Processes and stores the spaces in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @throws Error if synchronization fails
 */
async function syncSpaces(integrationRunId: number): Promise<void> {
	try {
		console.log('Syncing spaces...');

		// Step 1: Determine last sync point
		const lastUpdatedSpace = await db.query.airtableSpaces.findFirst({
			orderBy: {
				contentUpdatedAt: 'desc',
			},
			where: {
				contentUpdatedAt: {
					isNotNull: true,
				},
			},
		});
		const lastUpdatedTime = lastUpdatedSpace?.contentUpdatedAt;
		console.log(`Last updated space: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

		// Step 2: Fetch new or updated spaces
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

		// Step 3: Process and store spaces
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

		console.log(`Syncing ${spacesToSync.length} spaces`);

		// Use a transaction to ensure all spaces are synced atomically
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

		console.log(`Successfully synced ${spacesToSync.length} spaces`);
	} catch (error) {
		console.error('Error syncing spaces:', error);
		throw new Error(
			`Failed to sync spaces: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Synchronizes Airtable extracts with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new or updated extracts from Airtable
 * 3. Processes and stores the extracts in the database
 * 4. Handles attachments, creators, and spaces relationships
 * 5. Updates parent-child relationships and connections
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns Object containing the IDs of updated extracts
 * @throws Error if synchronization fails
 */
async function syncExtracts(integrationRunId: number): Promise<{
	updatedExtractIds: string[];
}> {
	try {
		console.log('Syncing extracts...');

		// Step 1: Determine last sync point
		const lastUpdatedExtract = await db.query.airtableExtracts.findFirst({
			orderBy: {
				contentUpdatedAt: 'desc',
			},
			where: {
				contentUpdatedAt: {
					isNotNull: true,
				},
			},
		});
		const lastUpdatedTime = lastUpdatedExtract?.contentUpdatedAt;
		console.log(`Last updated extract: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

		// Step 2: Fetch new or updated extracts
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

		// Step 3: Parse and validate the extract records
		const parsedRecords = updatedRecords.map((record) => ({
			id: record.id,
			fields: ExtractFieldSetSchema.parse(record.fields),
		}));

		console.log(`Syncing ${parsedRecords.length} extracts`);

		// Step 4: First pass - Upsert extracts and their relationships
		await db.transaction(async (tx) => {
			for (const record of parsedRecords) {
				const fields = record.fields;

				// Create the extract record
				const newExtract: AirtableExtractInsert = {
					id: record.id,
					title: fields.title,
					formatString: fields.format,
					source: fields.source,
					michelinStars: fields.michelinStars,
					content: fields.extract,
					notes: fields.notes,
					attachmentCaption: fields.imageCaption,
					parentId: null, // Will be updated in the second pass
					lexicographicalOrder: 'a0',
					publishedAt: fields.publishedOn,
					contentCreatedAt: fields.extractedOn,
					contentUpdatedAt: fields.lastUpdated,
					integrationRunId,
				};

				console.log(`Syncing extract ${newExtract.title}`);

				// Insert or update the extract
				await tx
					.insert(airtableExtracts)
					.values(newExtract)
					.onConflictDoUpdate({
						target: [airtableExtracts.id],
						set: {
							...newExtract,
						},
					});

				// Process attachments
				if (fields.images) {
					for (const image of fields.images) {
						console.log(`Uploading media ${image.filename} for extract ${record.id}`);

						// Upload the image to R2 storage
						const permanentUrl = await uploadMediaToR2(image.url);
						console.log(`Uploaded to ${permanentUrl}, inserting attachment...`);

						// Create the attachment record
						const attachment: AirtableAttachmentInsert = {
							id: image.id,
							url: permanentUrl,
							filename: image.filename,
							size: image.size,
							width: image.width,
							height: image.height,
							type: image.type,
							extractId: record.id,
						};

						// Insert or update the attachment
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

		// Step 5: Second pass - Update parent-child relationships and connections
		await updateExtractRelationships(parsedRecords);

		return { updatedExtractIds: parsedRecords.map((record) => record.id) };
	} catch (error) {
		console.error('Error syncing extracts:', error);
		throw new Error(
			`Failed to sync extracts: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Updates parent-child relationships and connections between extracts
 *
 * @param parsedRecords - The parsed extract records
 */
async function updateExtractRelationships(
	parsedRecords: Array<{ id: string; fields: ReturnType<typeof ExtractFieldSetSchema.parse> }>
): Promise<void> {
	for (const record of parsedRecords) {
		const { parentId, connectionIds } = record.fields;

		// Update parent-child relationship
		if (parentId?.[0]) {
			await db
				.update(airtableExtracts)
				.set({ parentId: parentId[0] })
				.where(eq(airtableExtracts.id, record.id));
		}

		// Update connections
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
}

/**
 * Synchronizes Airtable formats with the database
 *
 * This function:
 * 1. Finds extracts without a linked format
 * 2. Links them to existing formats or creates new ones
 *
 * @param integrationRunId - The ID of the current integration run
 * @throws Error if synchronization fails
 */
async function syncFormats(integrationRunId: number): Promise<void> {
	try {
		console.log('Syncing formats...');

		// Find extracts without a linked format
		const unlinkedExtracts = await db.query.airtableExtracts.findMany({
			where: {
				formatId: {
					isNull: true,
				},
				formatString: {
					isNotNull: true,
				},
			},
			orderBy: {
				contentUpdatedAt: 'asc',
			},
		});

		if (unlinkedExtracts.length === 0) {
			console.log('No new formats to sync');
			return;
		}

		console.log(`Syncing ${unlinkedExtracts.length} formats`);

		// Process each unlinked extract
		await db.transaction(async (tx) => {
			for (const extract of unlinkedExtracts) {
				// Skip if no format string
				if (!extract.formatString) {
					console.log(`Extract ${extract.id} has no format string, skipping`);
					continue;
				}

				// Try to find an existing format
				const format = await tx.query.airtableFormats.findFirst({
					where: {
						name: extract.formatString,
					},
				});

				if (format) {
					// Link to existing format
					await tx
						.update(airtableExtracts)
						.set({ formatId: format.id })
						.where(eq(airtableExtracts.id, extract.id));
				} else {
					// Create a new format
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

					// Link to the new format
					await tx
						.update(airtableExtracts)
						.set({ formatId: newFormat.id })
						.where(eq(airtableExtracts.id, extract.id));
				}
			}
		});

		console.log(`Successfully linked ${unlinkedExtracts.length} extracts to formats`);
	} catch (error) {
		console.error('Error syncing formats:', error);
		throw new Error(
			`Failed to sync formats: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Orchestrates the Airtable data synchronization process
 *
 * This function coordinates the execution of multiple Airtable integration steps:
 * 1. Syncs creators
 * 2. Syncs spaces
 * 3. Syncs extracts
 * 4. Syncs formats
 * 5. Creates records from Airtable entities
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of extracts synced
 * @throws Error if synchronization fails
 */
async function syncAirtableData(integrationRunId: number): Promise<number> {
	try {
		console.log('Starting Airtable data synchronization');

		// Step 1: Sync creators
		await syncCreators(integrationRunId);

		// Step 2: Sync spaces
		await syncSpaces(integrationRunId);

		// Step 3: Sync extracts
		const { updatedExtractIds } = await syncExtracts(integrationRunId);

		// Step 4: Sync formats
		await syncFormats(integrationRunId);

		// Count the number of extracts synced
		const count = await db.$count(
			airtableExtracts,
			eq(airtableExtracts.integrationRunId, integrationRunId)
		);

		// Step 5: Store media and create records
		const updatedMediaCount = await storeMedia();
		console.log(`Updated ${updatedMediaCount} media records`);

		await createRecordsFromAirtableFormats();
		await createRecordsFromAirtableCreators();
		await createRecordsFromAirtableSpaces();
		await createMediaFromAirtableAttachments();
		await createRecordsFromAirtableExtracts();
		await createConnectionsBetweenRecords(updatedExtractIds);

		console.log('Airtable data synchronization completed successfully');
		return count;
	} catch (error) {
		console.error('Error syncing Airtable data:', error);
		throw new Error(
			`Failed to sync Airtable data: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING AIRTABLE SYNC ===\n');
		await runIntegration('airtable', syncAirtableData);
		console.log('\n=== AIRTABLE SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Airtable sync main function:', error);
		console.log('\n=== AIRTABLE SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncAirtableData };
