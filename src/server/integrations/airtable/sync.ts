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
} from '@hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { uploadMediaToR2 } from '@/server/lib/media';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
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

const logger = createIntegrationLogger('airtable', 'sync');

/**
 * Synchronizes Airtable creators with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new or updated creators from Airtable
 * 3. Processes and stores the creators in the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The raw Airtable records for debug purposes
 * @throws Error if synchronization fails
 */
async function syncCreators(integrationRunId: number, collectDebugData?: unknown[]): Promise<void> {
  try {
    logger.start('Syncing creators');

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
    logger.info(`Last updated creator: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

    // Step 2: Fetch new or updated creators
    logger.info(
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
      logger.info('No new creators to sync');
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

    logger.info(`Syncing ${creatorsToSync.length} creators`);

    collectDebugData?.push(...updatedRecords);

    // Use a transaction to ensure all creators are synced atomically
    await db.transaction(async (tx) => {
      for (const creator of creatorsToSync) {
        logger.info(`Syncing creator ${creator.name}`);
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

    logger.complete(`Synced creators`, creatorsToSync.length);
  } catch (error) {
    logger.error('Error syncing creators', error);
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
async function syncSpaces(integrationRunId: number, collectDebugData?: unknown[]): Promise<void> {
  try {
    logger.start('Syncing spaces');

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
    logger.info(`Last updated space: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

    // Step 2: Fetch new or updated spaces
    const updatedRecords = await airtableBase('Spaces')
      .select({
        filterByFormula: lastUpdatedTime
          ? `lastUpdated > '${lastUpdatedTime.toISOString()}'`
          : undefined,
      })
      .all();

    if (updatedRecords.length === 0) {
      logger.info('No new spaces to sync');
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

    logger.info(`Syncing ${spacesToSync.length} spaces`);

    collectDebugData?.push(...updatedRecords);

    // Use a transaction to ensure all spaces are synced atomically
    await db.transaction(async (tx) => {
      for (const space of spacesToSync) {
        logger.info(`Syncing space ${space.name}`);
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

    logger.complete(`Synced spaces`, spacesToSync.length);
  } catch (error) {
    logger.error('Error syncing spaces', error);
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
 * @param collectDebugData - Optional array to collect raw Airtable records for debugging
 * @returns Object containing the IDs of updated extracts
 * @throws Error if synchronization fails
 */
async function syncExtracts(
  integrationRunId: number,
  collectDebugData?: unknown[]
): Promise<{
  updatedExtractIds: string[];
}> {
  try {
    logger.start('Syncing extracts');

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
    logger.info(`Last updated extract: ${lastUpdatedTime?.toLocaleString() ?? 'none'}`);

    // Step 2: Fetch new or updated extracts
    const updatedRecords = await airtableBase('Extracts')
      .select({
        filterByFormula: lastUpdatedTime
          ? `lastUpdated > '${lastUpdatedTime.toISOString()}'`
          : undefined,
      })
      .all();

    if (updatedRecords.length === 0) {
      logger.info('No new extracts to sync');
      return { updatedExtractIds: [] };
    }

    // Step 3: Parse and validate the extract records
    const parsedRecords = updatedRecords.map((record) => ({
      id: record.id,
      fields: ExtractFieldSetSchema.parse(record.fields),
    }));

    logger.info(`Syncing ${parsedRecords.length} extracts`);

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

        logger.info(`Syncing extract ${newExtract.title}`);

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
            logger.info(`Uploading media ${image.filename} for extract ${record.id}`);

            // Upload the image to R2 storage
            const permanentUrl = await uploadMediaToR2(image.url);
            logger.info(`Uploaded to ${permanentUrl}, inserting attachment...`);

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

    collectDebugData?.push(...updatedRecords);

    return {
      updatedExtractIds: parsedRecords.map((record) => record.id),
    };
  } catch (error) {
    logger.error('Error syncing extracts', error);
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
async function syncFormats(integrationRunId: number, collectDebugData?: unknown[]): Promise<void> {
  try {
    logger.start('Syncing formats');

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
      logger.info('No new formats to sync');
      return;
    }

    logger.info(`Syncing ${unlinkedExtracts.length} formats`);

    // Process each unlinked extract
    await db.transaction(async (tx) => {
      for (const extract of unlinkedExtracts) {
        // Skip if no format string
        if (!extract.formatString) {
          logger.info(`Extract ${extract.id} has no format string, skipping`);
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
          logger.info(`Format ${extract.formatString} not found, creating new format...`);
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
            logger.error(`Failed to create new format ${extract.formatString}`);
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

    logger.complete(`Linked extracts to formats`, unlinkedExtracts.length);
    collectDebugData?.push(...unlinkedExtracts);
  } catch (error) {
    logger.error('Error syncing formats', error);
    throw new Error(
      `Failed to sync formats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Fetches all Airtable data from API without persisting
 *
 * @param debugData - Object to collect raw API data
 */
async function fetchAirtableDataOnly(debugData: {
  creators: unknown[];
  spaces: unknown[];
  extracts: unknown[];
}): Promise<void> {
  // Fetch creators
  logger.info('Fetching creators from Airtable');
  const creatorRecords = await airtableBase('Creators').select({}).all();
  debugData.creators.push(...creatorRecords);
  logger.info(`Fetched ${creatorRecords.length} creators`);

  // Fetch spaces
  logger.info('Fetching spaces from Airtable');
  const spaceRecords = await airtableBase('Spaces').select({}).all();
  debugData.spaces.push(...spaceRecords);
  logger.info(`Fetched ${spaceRecords.length} spaces`);

  // Fetch extracts
  logger.info('Fetching extracts from Airtable');
  const extractRecords = await airtableBase('Extracts').select({}).all();
  debugData.extracts.push(...extractRecords);
  logger.info(`Fetched ${extractRecords.length} extracts`);
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
    logger.info(`Updated ${updatedMediaCount} media records`);

    await createRecordsFromAirtableFormats();
    await createRecordsFromAirtableCreators();
    await createRecordsFromAirtableSpaces();
    await createMediaFromAirtableAttachments();
    await createRecordsFromAirtableExtracts();
    await createConnectionsBetweenRecords(updatedExtractIds);

    logger.complete('Airtable data synchronization completed', count);
    return count;
  } catch (error) {
    logger.error('Error syncing Airtable data', error);
    throw new Error(
      `Failed to sync Airtable data: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Wrapper function that uses runIntegration
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 */
async function syncAirtableDataWithIntegration(debug = false): Promise<void> {
  const debugContext = createDebugContext('airtable', debug, {
    creators: [] as unknown[],
    spaces: [] as unknown[],
    extracts: [] as unknown[],
  });
  try {
    if (debug) {
      // Debug mode: fetch data and output to .temp/ only, skip database writes
      logger.start('Starting Airtable data fetch (debug mode - no database writes)');
      if (debugContext.data) {
        await fetchAirtableDataOnly(debugContext.data);
      }
      logger.complete('Airtable data fetch completed (debug mode)');
    } else {
      // Normal mode: full sync with database writes
      logger.start('Starting Airtable data synchronization');
      await runIntegration('airtable', (runId) => syncAirtableData(runId));
      logger.complete('Airtable data synchronization completed');
    }
  } catch (error) {
    logger.error('Error syncing Airtable data', error);
    throw error;
  } finally {
    await debugContext.flush().catch((flushError) => {
      logger.error('Failed to write debug output for Airtable', flushError);
    });
  }
}

export { syncAirtableDataWithIntegration as syncAirtableData };
