import { eq, inArray, isNull, or } from 'drizzle-orm';
import { mapUrl } from '@/app/lib/formatting';
import { db } from '@/server/db/connections';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtractConnections,
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
	type MediaInsert,
	type RecordCreatorInsert,
	type RecordInsert,
	type RecordRelationInsert,
} from '@/server/db/schema';
import {
	bulkInsertRecordCreators,
	bulkInsertRecordRelations,
	setRecordParent,
} from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';
import { getMediaInsertData } from '../common/media-helpers';

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
		needsCuration: true,
		isPrivate: false,
		isFormat: true,
		isIndexNode: true,
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
		where: isNull(airtableFormats.recordId),
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
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
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
		where: isNull(airtableCreators.recordId),
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
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
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
		where: isNull(airtableSpaces.recordId),
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
		where: isNull(airtableAttachments.mediaId),
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
	const stars = extract.michelinStars;
	const rating = stars === 3 ? 2 : stars > 0 ? 1 : 0;

	return {
		id: extract.recordId ?? undefined,
		type: 'artifact',
		title: extract.title,
		url: extract.source,
		content: extract.content,
		notes: extract.notes,
		mediaCaption: extract.attachmentCaption,
		parentId: extract.parent?.recordId,
		formatId: extract.format?.recordId,
		rating,
		needsCuration: false,
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
		where: isNull(airtableExtracts.recordId),
		with: {
			format: true,
			attachments: true,
			extractCreators: {
				with: {
					creator: true,
				},
			},
			extractSpaces: {
				with: {
					space: true,
				},
			},
			parent: true,
			outgoingConnections: {
				with: {
					toExtract: true,
				},
			},
			incomingConnections: {
				with: {
					fromExtract: true,
				},
			},
		},
	});

	if (extracts.length === 0) {
		logger.skip('No new Airtable extracts to process');
		return;
	}

	logger.info(`Found ${extracts.length} unmapped Airtable extracts`);

	// Map to store new record IDs keyed by their Airtable extract id.
	const recordMap = new Map<string, number>();

	// Prepare bulk insert arrays
	const recordCreatorsValues: RecordCreatorInsert[] = [];
	const recordRelationsValues: RecordRelationInsert[] = [];

	// Step 1: Create records
	for (const extract of extracts) {
		const recordPayload = mapAirtableExtractToRecord(extract);

		// Insert the record into the main records table.
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

		// Update the Airtable extract with the new record id.
		await db
			.update(airtableExtracts)
			.set({ recordId: insertedRecord.id })
			.where(eq(airtableExtracts.id, extract.id));

		recordMap.set(extract.id, insertedRecord.id);
		logger.info(`Created record ${insertedRecord.id} for Airtable extract ${extract.id}`);

		// Link media if attachments exist and have been mapped.
		for (const attachment of extract.attachments) {
			if (attachment.mediaId) {
				await db
					.update(media)
					.set({ recordId: insertedRecord.id })
					.where(eq(media.id, attachment.mediaId));

				logger.info(`Linked media ${attachment.mediaId} to record ${insertedRecord.id}`);
			}
		}

		// Prepare creator links
		for (const creator of extract.extractCreators) {
			if (creator.creator.recordId) {
				recordCreatorsValues.push({
					recordId: insertedRecord.id,
					creatorId: creator.creator.recordId,
					creatorRole: 'creator',
				});
			}
		}

		// Prepare space links
		for (const space of extract.extractSpaces) {
			if (space.space.recordId) {
				recordRelationsValues.push({
					sourceId: insertedRecord.id,
					targetId: space.space.recordId,
					type: 'tagged',
				});
			}
		}

		// Prepare outgoing connection links
		for (const connection of extract.outgoingConnections) {
			if (connection.toExtract.recordId) {
				recordRelationsValues.push({
					sourceId: insertedRecord.id,
					targetId: connection.toExtract.recordId,
					type: 'related_to',
				});
			}
		}

		// Prepare incoming connection links
		for (const connection of extract.incomingConnections) {
			if (connection.fromExtract.recordId) {
				recordRelationsValues.push({
					sourceId: connection.fromExtract.recordId,
					targetId: insertedRecord.id,
					type: 'related_to',
				});
			}
		}
	}

	// Bulk insert relationships
	if (recordCreatorsValues.length > 0) {
		await bulkInsertRecordCreators(recordCreatorsValues);
		logger.info(`Linked ${recordCreatorsValues.length} creators to records`);
	}

	if (recordRelationsValues.length > 0) {
		await bulkInsertRecordRelations(recordRelationsValues);
		logger.info(`Created ${recordRelationsValues.length} record relationships`);
	}

	// Step 2: Link parent–child relationships (if any)
	for (const extract of extracts) {
		if (extract.parentId) {
			// Look up the parent record either from the map (created in this run) or from the DB.
			const childRecordId = recordMap.get(extract.id);
			if (!childRecordId) continue;

			let parentRecordId = recordMap.get(extract.parentId);
			if (!parentRecordId) {
				const parentExtract = await db.query.airtableExtracts.findFirst({
					where: eq(airtableExtracts.id, extract.parentId),
					columns: { recordId: true },
				});
				parentRecordId = parentExtract?.recordId ?? undefined;
			}

			if (parentRecordId) {
				await setRecordParent(childRecordId, parentRecordId, 'part_of');
				logger.info(`Linked child record ${childRecordId} to parent record ${parentRecordId}`);
			} else {
				logger.warn(`Skipping linking for extract ${extract.id} due to missing parent record id`);
			}
		}
	}

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
			? or(
					inArray(airtableExtractConnections.fromExtractId, updatedIds),
					inArray(airtableExtractConnections.toExtractId, updatedIds)
				)
			: undefined,
	});

	if (connections.length === 0) {
		logger.skip('No connections to process');
		return;
	}

	logger.info(`Found ${connections.length} connections to process`);

	const relationValues: RecordRelationInsert[] = [];

	for (const connection of connections) {
		if (connection.fromExtract.recordId && connection.toExtract.recordId) {
			logger.info(
				`Processing connection between ${connection.fromExtract.title} (${connection.fromExtract.id}) and ${connection.toExtract.title} (${connection.toExtract.id})`
			);

			relationValues.push({
				sourceId: connection.fromExtract.recordId,
				targetId: connection.toExtract.recordId,
				type: 'related_to',
			});
		}
	}

	if (relationValues.length > 0) {
		await bulkInsertRecordRelations(relationValues);
		logger.info(`Created ${relationValues.length} record relationships`);
	}

	logger.complete(`Processed ${connections.length} connections`);
}
