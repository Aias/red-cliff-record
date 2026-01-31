import {
  airtableAttachments,
  airtableCreators,
  airtableExtracts,
  airtableFormats,
  airtableSpaces,
  media,
  records,
  type AirtableAttachmentSelect,
  type AirtableCreatorSelect,
  type AirtableExtractSelect,
  type AirtableFormatSelect,
  type AirtableSpaceSelect,
  type LinkInsert,
  type MediaInsert,
  type RecordInsert,
} from '@hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { getMediaInsertData } from '@/server/lib/media';
import { mapUrl } from '@/server/lib/url-utils';
import { bulkInsertLinks, getPredicateId } from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('airtable', 'map');

// ------------------------------------------------------------------------
// 1. Create formats from Airtable and map to records
// ------------------------------------------------------------------------

/**
 * Maps an Airtable format to a record
 *
 * @param format - The Airtable format to map
 * @returns A record insert object
 */
const mapFormatToRecord = (format: AirtableFormatSelect): RecordInsert => {
  return {
    id: format.recordId ?? undefined,
    type: 'concept',
    title: format.name,
    sources: ['airtable'],
    isCurated: false,
    isPrivate: false,
    recordCreatedAt: format.recordCreatedAt,
    recordUpdatedAt: format.recordUpdatedAt,
  };
};

/**
 * Creates records from Airtable formats that don't have associated records yet
 */
export async function createRecordsFromAirtableFormats() {
  logger.start('Creating records from Airtable formats');

  const formats = await db.query.airtableFormats.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
    with: {
      extracts: {
        columns: {
          recordId: true,
        },
      },
    },
  });

  if (formats.length === 0) {
    logger.skip('No new Airtable formats to process');
    return;
  }

  logger.info(`Found ${formats.length} unmapped Airtable formats`);

  for (const format of formats) {
    const record = mapFormatToRecord(format);
    logger.info(`Creating record for format ${format.name}`);

    const [newRecord] = await db
      .insert(records)
      .values(record)
      .onConflictDoUpdate({
        target: records.id,
        set: { recordUpdatedAt: new Date() },
      })
      .returning({ id: records.id });

    if (!newRecord) {
      logger.error(`Failed to create record for format ${format.name}`);
      continue;
    }

    await db
      .update(airtableFormats)
      .set({ recordId: newRecord.id })
      .where(eq(airtableFormats.id, format.id));

    logger.info(`Linked format ${format.name} to record ${newRecord.id}`);
  }

  logger.complete(`Processed ${formats.length} Airtable formats`);
}

// ------------------------------------------------------------------------
// 2. Create creators from Airtable and map to records
// ------------------------------------------------------------------------

/**
 * Maps an Airtable creator to a record
 *
 * @param creator - The Airtable creator to map
 * @returns A record insert object
 */
const mapAirtableCreatorToRecord = (creator: AirtableCreatorSelect): RecordInsert => {
  return {
    id: creator.recordId ?? undefined,
    type: 'entity',
    title: creator.name,
    url: creator.website ? mapUrl(creator.website) : undefined,
    sources: ['airtable'],
    isCurated: false,
    isPrivate: false,
    recordCreatedAt: creator.recordCreatedAt,
    recordUpdatedAt: creator.recordUpdatedAt,
    contentCreatedAt: creator.contentCreatedAt,
    contentUpdatedAt: creator.contentUpdatedAt,
  };
};

/**
 * Creates records from Airtable creators that don't have associated records yet
 */
export async function createRecordsFromAirtableCreators() {
  logger.start('Creating records from Airtable creators');

  const creators = await db.query.airtableCreators.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
  });
  if (creators.length === 0) {
    logger.skip('No new Airtable creators to process');
    return;
  }

  logger.info(`Found ${creators.length} unmapped Airtable creators`);

  for (const creator of creators) {
    const entity = mapAirtableCreatorToRecord(creator);

    const [newRecord] = await db
      .insert(records)
      .values(entity)
      .onConflictDoUpdate({
        target: records.id,
        set: { recordUpdatedAt: new Date() },
      })
      .returning({ id: records.id });

    if (!newRecord) {
      logger.error(`Failed to create record for creator ${creator.name}`);
      continue;
    }

    await db
      .update(airtableCreators)
      .set({ recordId: newRecord.id })
      .where(eq(airtableCreators.id, creator.id));

    logger.info(`Linked creator ${creator.name} to record ${newRecord.id}`);
  }

  logger.complete(`Processed ${creators.length} Airtable creators`);
}

// ------------------------------------------------------------------------
// 3. Create spaces from Airtable and map to records
// ------------------------------------------------------------------------

/**
 * Maps an Airtable space to a record
 *
 * @param space - The Airtable space to map
 * @returns A record insert object
 */
const mapAirtableSpaceToRecord = (space: AirtableSpaceSelect): RecordInsert => {
  return {
    id: space.recordId ?? undefined,
    type: 'concept',
    title: space.name,
    summary: [space.icon, space.fullName].filter(Boolean).join(' ') || undefined,
    sources: ['airtable'],
    isCurated: false,
    isPrivate: false,
    recordCreatedAt: space.recordCreatedAt,
    recordUpdatedAt: space.recordUpdatedAt,
    contentCreatedAt: space.contentCreatedAt,
    contentUpdatedAt: space.contentUpdatedAt,
  };
};

/**
 * Creates records from Airtable spaces that don't have associated records yet
 */
export async function createRecordsFromAirtableSpaces() {
  logger.start('Creating records from Airtable spaces');

  const spaces = await db.query.airtableSpaces.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
  });
  if (spaces.length === 0) {
    logger.skip('No new Airtable spaces to process');
    return;
  }

  logger.info(`Found ${spaces.length} unmapped Airtable spaces`);

  for (const space of spaces) {
    const record = mapAirtableSpaceToRecord(space);

    const [newRecord] = await db
      .insert(records)
      .values(record)
      .onConflictDoUpdate({
        target: records.id,
        set: { recordUpdatedAt: new Date() },
      })
      .returning({ id: records.id });

    if (!newRecord) {
      logger.error(`Failed to create record for space ${space.name}`);
      continue;
    }

    await db
      .update(airtableSpaces)
      .set({ recordId: newRecord.id })
      .where(eq(airtableSpaces.id, space.id));

    logger.info(`Linked space ${space.name} to record ${newRecord.id}`);
  }

  logger.complete(`Processed ${spaces.length} Airtable spaces`);
}

// ------------------------------------------------------------------------
// 4. Create media from Airtable attachments
// ------------------------------------------------------------------------

/**
 * Maps an Airtable attachment to a media object
 *
 * @param attachment - The Airtable attachment to map
 * @returns A promise resolving to a media insert object or null if processing fails
 */
const mapAirtableAttachmentToMedia = async (
  attachment: AirtableAttachmentSelect & { extract: AirtableExtractSelect }
): Promise<MediaInsert | null> => {
  try {
    // Since the URL should already be uploaded to R2 during the sync process,
    // we only need to get the metadata
    return getMediaInsertData(attachment.url, {
      recordId: attachment.extract.recordId,
      recordCreatedAt: attachment.extract.recordCreatedAt,
      recordUpdatedAt: attachment.extract.recordUpdatedAt,
    });
  } catch (error) {
    logger.error(`Error getting metadata for media ${attachment.url}`, error);
    return null;
  }
};

/**
 * Creates media from Airtable attachments that don't have associated media yet
 */
export async function createMediaFromAirtableAttachments() {
  logger.start('Creating media from Airtable attachments');

  const attachments = await db.query.airtableAttachments.findMany({
    where: {
      mediaId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
    with: {
      extract: true,
    },
  });

  if (attachments.length === 0) {
    logger.skip('No new Airtable attachments to process');
    return;
  }

  logger.info(`Found ${attachments.length} unmapped Airtable attachments`);

  for (const attachment of attachments) {
    const mediaItem = await mapAirtableAttachmentToMedia(attachment);

    if (!mediaItem) {
      logger.error(`Failed to create media for attachment ${attachment.url}`);
      continue;
    }

    const [newMedia] = await db
      .insert(media)
      .values(mediaItem)
      .onConflictDoUpdate({
        target: [media.url, media.recordId],
        set: { recordUpdatedAt: new Date() },
      })
      .returning({ id: media.id });

    if (!newMedia) {
      logger.error(`Failed to upsert media for attachment ${attachment.url}`);
      continue;
    }

    await db
      .update(airtableAttachments)
      .set({ mediaId: newMedia.id })
      .where(eq(airtableAttachments.id, attachment.id));

    logger.info(`Linked attachment ${attachment.url} to media ${newMedia.id}`);
  }

  logger.complete(`Processed ${attachments.length} Airtable attachments`);
}

// ------------------------------------------------------------------------
// 5. Create records from Airtable extracts
// ------------------------------------------------------------------------

/**
 * Maps an Airtable extract to a record
 *
 * @param extract - The Airtable extract to map
 * @returns A record insert object
 */
const mapAirtableExtractToRecord = (
  extract: AirtableExtractSelect & {
    parent: AirtableExtractSelect | null;
    format: AirtableFormatSelect | null;
  }
): RecordInsert => {
  return {
    id: extract.recordId ?? undefined,
    type: 'artifact',
    title: extract.title,
    url: extract.source,
    content: extract.content,
    notes: extract.notes,
    mediaCaption: extract.attachmentCaption,
    rating: extract.michelinStars,
    isCurated: false,
    isPrivate: extract.publishedAt ? false : true,
    sources: ['airtable'],
    recordCreatedAt: extract.recordCreatedAt,
    recordUpdatedAt: extract.recordUpdatedAt,
    contentCreatedAt: extract.contentCreatedAt,
    contentUpdatedAt: extract.contentUpdatedAt,
  };
};

/**
 * Creates records from Airtable extracts that don't have associated records yet
 */
export async function createRecordsFromAirtableExtracts() {
  logger.start('Creating records from Airtable extracts');

  const extracts = await db.query.airtableExtracts.findMany({
    where: {
      recordId: {
        isNull: true,
      },
      deletedAt: {
        isNull: true,
      },
    },
    with: {
      format: true,
      attachments: true,
      creators: true,
      spaces: true,
      parent: true,
      outgoingConnections: true,
      incomingConnections: true,
    },
  });

  if (extracts.length === 0) {
    logger.skip('No new Airtable extracts to process');
    return;
  }

  logger.info(`Found ${extracts.length} unmapped Airtable extracts`);

  // Map to store new record IDs keyed by their Airtable extract id (string).
  const recordMap = new Map<string, number>();

  // ------------------------------------------------------------------------
  // Pass 1: Create records and link media
  // ------------------------------------------------------------------------
  logger.info('Starting Pass 1: Create records and link media');
  for (const extract of extracts) {
    const recordPayload = mapAirtableExtractToRecord(extract);

    const [insertedRecord] = await db
      .insert(records)
      .values(recordPayload)
      .onConflictDoUpdate({
        target: records.id,
        set: {
          recordUpdatedAt: new Date(),
        },
      })
      .returning({ id: records.id });

    if (!insertedRecord) {
      logger.error(`Failed to create record for Airtable extract ${extract.id}`);
      continue;
    }

    await db
      .update(airtableExtracts)
      .set({ recordId: insertedRecord.id })
      .where(eq(airtableExtracts.id, extract.id));

    recordMap.set(extract.id, insertedRecord.id);
    logger.info(`Created record ${insertedRecord.id} for Airtable extract ${extract.id}`);

    for (const attachment of extract.attachments) {
      if (attachment.mediaId) {
        await db
          .update(media)
          .set({ recordId: insertedRecord.id })
          .where(eq(media.id, attachment.mediaId));
        logger.info(`Linked media ${attachment.mediaId} to record ${insertedRecord.id}`);
      }
    }
  }
  logger.info('Completed Pass 1.');

  // ------------------------------------------------------------------------
  // Pass 2: Create relationships
  // ------------------------------------------------------------------------
  logger.info('Starting Pass 2: Create relationships');

  const createdByPredicateId = await getPredicateId('created_by', db);
  const taggedWithPredicateId = await getPredicateId('tagged_with', db);
  const hasFormatPredicateId = await getPredicateId('has_format', db);
  const containedByPredicateId = await getPredicateId('contained_by', db);

  const recordCreatorsValues: LinkInsert[] = [];
  const recordFormatsValues: LinkInsert[] = [];
  const recordParentValues: LinkInsert[] = [];
  const recordTagsValues: LinkInsert[] = [];

  for (const extract of extracts) {
    const sourceRecordId = recordMap.get(extract.id);
    if (!sourceRecordId) {
      logger.warn(
        `Could not find created recordId for extract ${extract.id} in Pass 2. Skipping relationship creation for this extract.`
      );
      continue;
    }

    // Parent-child links
    if (extract.parent?.id) {
      const parentRecordId = extract.parent.recordId ?? recordMap.get(extract.parent.id);
      if (parentRecordId) {
        recordParentValues.push({
          sourceId: sourceRecordId,
          targetId: parentRecordId,
          predicateId: containedByPredicateId,
        });
      } else {
        logger.warn(
          `Parent extract Airtable ID ${extract.parent.id} for child ${extract.id} (Record ID: ${sourceRecordId}) not found in recordMap and has no existing recordId. Parent link cannot be created.`
        );
      }
    }

    // Format links
    if (extract.format?.recordId) {
      recordFormatsValues.push({
        sourceId: sourceRecordId,
        targetId: extract.format.recordId,
        predicateId: hasFormatPredicateId,
      });
    }

    // Creator links
    for (const creator of extract.creators) {
      if (creator.recordId) {
        recordCreatorsValues.push({
          sourceId: sourceRecordId,
          targetId: creator.recordId,
          predicateId: createdByPredicateId,
        });
      } else {
        logger.warn(
          `Creator ${creator.id} for extract ${extract.id} does not have a recordId. It may not have been processed yet.`
        );
      }
    }

    // Space links
    for (const space of extract.spaces) {
      if (space.recordId) {
        recordTagsValues.push({
          sourceId: sourceRecordId,
          targetId: space.recordId,
          predicateId: taggedWithPredicateId,
        });
      } else {
        logger.warn(
          `Space ${space.id} for extract ${extract.id} does not have a recordId. It may not have been processed yet.`
        );
      }
    }
  }

  // Bulk insert relationships
  if (recordCreatorsValues.length > 0) {
    await bulkInsertLinks(recordCreatorsValues, db);
    logger.info(`Linked ${recordCreatorsValues.length} creators to records`);
  }

  if (recordFormatsValues.length > 0) {
    await bulkInsertLinks(recordFormatsValues, db);
    logger.info(`Linked ${recordFormatsValues.length} formats to records`);
  }

  if (recordParentValues.length > 0) {
    await bulkInsertLinks(recordParentValues, db);
    logger.info(`Linked ${recordParentValues.length} parent-child relationships`);
  }

  if (recordTagsValues.length > 0) {
    await bulkInsertLinks(recordTagsValues, db);
    logger.info(`Linked ${recordTagsValues.length} tags to records`);
  }
  logger.info('Completed Pass 2.');

  logger.complete(`Processed ${extracts.length} Airtable extracts`);
}

// ------------------------------------------------------------------------
// 6. Create connections between records
// ------------------------------------------------------------------------

/**
 * Creates connections between records based on Airtable extract connections
 *
 * @param updatedIds - Optional array of extract IDs to limit processing
 */
export async function createConnectionsBetweenRecords(updatedIds?: string[]) {
  logger.start('Creating connections between records');

  const connections = await db.query.airtableExtractConnections.findMany({
    with: {
      fromExtract: true,
      toExtract: true,
    },
    where: updatedIds
      ? {
          OR: [
            {
              fromExtractId: {
                in: updatedIds,
              },
            },
            {
              toExtractId: {
                in: updatedIds,
              },
            },
          ],
        }
      : undefined,
  });

  if (connections.length === 0) {
    logger.skip('No connections to process');
    return;
  }

  logger.info(`Found ${connections.length} connections to process`);

  const relatedToPredicateId = await getPredicateId('related_to', db);
  const relationValues: LinkInsert[] = [];

  for (const connection of connections) {
    if (connection.fromExtract.recordId && connection.toExtract.recordId) {
      logger.info(
        `Processing connection between ${connection.fromExtract.title} (${connection.fromExtract.id}) and ${connection.toExtract.title} (${connection.toExtract.id})`
      );

      relationValues.push({
        sourceId: connection.fromExtract.recordId,
        targetId: connection.toExtract.recordId,
        predicateId: relatedToPredicateId,
      });
    }
  }

  if (relationValues.length > 0) {
    await bulkInsertLinks(relationValues, db);
    logger.info(`Created ${relationValues.length} record relationships`);
  }

  logger.complete(`Processed ${connections.length} connections`);
}
