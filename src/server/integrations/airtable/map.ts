import { eq, inArray, isNull, or } from 'drizzle-orm';
import { validateAndFormatUrl } from '~/app/lib/formatting';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { db } from '~/server/db/connections/postgres';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtractConnections,
	// Airtable integration (staging) tables
	airtableExtracts,
	airtableSpaces,
	// Main tables
	indices,
	media,
	recordCategories,
	recordCreators,
	recordMedia,
	// The unified linking table for record relations
	recordRelations,
	records,
	// Types
	type AirtableAttachmentSelect,
	type AirtableCreatorSelect,
	type AirtableExtractSelect,
	type AirtableSpaceSelect,
	type IndicesInsert,
	type MediaInsert,
	type RecordInsert,
} from '~/server/db/schema';

/* ----------------------------------------------------------------------------
   1. Create index entities from Airtable Creators
---------------------------------------------------------------------------- */
const mapAirtableCreatorToIndexEntry = (creator: AirtableCreatorSelect): IndicesInsert => {
	return {
		name: creator.name,
		canonicalUrl: creator.website ? validateAndFormatUrl(creator.website) : undefined,
		mainType: 'entity',
		needsCuration: false,
		isPrivate: false,
		sources: ['airtable'],
		recordCreatedAt: creator.recordCreatedAt,
		recordUpdatedAt: creator.recordUpdatedAt,
		contentCreatedAt: creator.contentCreatedAt,
		contentUpdatedAt: creator.contentUpdatedAt,
	};
};

export async function createEntitiesFromAirtableCreators() {
	console.log('Creating entities from Airtable creators');
	const creators = await db.query.airtableCreators.findMany({
		where: isNull(airtableCreators.indexEntryId),
	});
	if (creators.length === 0) {
		console.log('No new Airtable creators to process.');
		return;
	}

	console.log(`Processing ${creators.length} Airtable creators into index entities...`);

	for (const creator of creators) {
		const entity = mapAirtableCreatorToIndexEntry(creator);
		const [newEntity] = await db
			.insert(indices)
			.values(entity)
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: indices.id });
		if (!newEntity) {
			console.log(`Failed to create index entity for creator ${creator.name}`);
			continue;
		}
		await db
			.update(airtableCreators)
			.set({ indexEntryId: newEntity.id })
			.where(eq(airtableCreators.id, creator.id));
		console.log(`Linked creator ${creator.name} to index entity ${newEntity.id}`);
	}
}

/* ----------------------------------------------------------------------------
   2. Create index categories from Airtable Spaces
---------------------------------------------------------------------------- */
const mapAirtableSpaceToIndexEntry = (space: AirtableSpaceSelect): IndicesInsert => {
	return {
		name: space.name,
		notes: [space.icon, space.fullName].filter(Boolean).join(' ') || undefined,
		mainType: 'category',
		needsCuration: false,
		isPrivate: false,
		sources: ['airtable'],
		recordCreatedAt: space.recordCreatedAt,
		recordUpdatedAt: space.recordUpdatedAt,
		contentCreatedAt: space.contentCreatedAt,
		contentUpdatedAt: space.contentUpdatedAt,
	};
};

export async function createCategoriesFromAirtableSpaces() {
	console.log('Creating index categories from Airtable spaces');
	const spaces = await db.query.airtableSpaces.findMany({
		where: isNull(airtableSpaces.indexEntryId),
	});
	if (spaces.length === 0) {
		console.log('No new Airtable spaces to process.');
		return;
	}

	console.log(`Processing ${spaces.length} Airtable spaces into index categories...`);
	for (const space of spaces) {
		const category = mapAirtableSpaceToIndexEntry(space);
		const [newCategory] = await db
			.insert(indices)
			.values(category)
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: indices.id });
		if (!newCategory) {
			console.log(`Failed to create index category for space ${space.name}`);
			continue;
		}
		await db
			.update(airtableSpaces)
			.set({ indexEntryId: newCategory.id })
			.where(eq(airtableSpaces.id, space.id));
		console.log(`Linked space ${space.name} to index category ${newCategory.id}`);
	}
}

/* ----------------------------------------------------------------------------
   3. Create media from Airtable Attachments
---------------------------------------------------------------------------- */
const mapAirtableAttachmentToMedia = async (
	attachment: AirtableAttachmentSelect,
	extract?: AirtableExtractSelect
): Promise<MediaInsert | null> => {
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(attachment.url);

		return {
			url: attachment.url,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			isPrivate: false,
			needsCuration: false,
			sources: ['airtable'],
			recordCreatedAt: attachment.recordCreatedAt,
			recordUpdatedAt: attachment.recordUpdatedAt,
			contentCreatedAt: extract?.contentCreatedAt || attachment.recordCreatedAt,
			contentUpdatedAt: extract?.contentUpdatedAt || attachment.recordUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', attachment.url, error);
		return null;
	}
};

export async function createMediaFromAirtableAttachments() {
	console.log('Creating media from Airtable attachments');
	const attachments = await db.query.airtableAttachments.findMany({
		where: isNull(airtableAttachments.mediaId),
	});
	if (attachments.length === 0) {
		console.log('No new Airtable attachments to process.');
		return;
	}
	console.log(`Creating ${attachments.length} media entries from Airtable attachments`);
	for (const attachment of attachments) {
		let associatedExtract;
		if (attachment.extractId) {
			associatedExtract = await db.query.airtableExtracts.findFirst({
				where: eq(airtableExtracts.id, attachment.extractId),
			});
		}
		const mediaItem = await mapAirtableAttachmentToMedia(attachment, associatedExtract);
		if (!mediaItem) {
			console.log(`Failed to create media for attachment ${attachment.url}`);
			continue;
		}
		const [newMedia] = await db
			.insert(media)
			.values(mediaItem)
			.onConflictDoUpdate({
				target: [media.url],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: media.id });
		if (!newMedia) {
			console.log(`Failed to upsert media for attachment ${attachment.url}`);
			continue;
		}
		await db
			.update(airtableAttachments)
			.set({ mediaId: newMedia.id })
			.where(eq(airtableAttachments.id, attachment.id));
		console.log(`Linked attachment ${attachment.url} to media ${newMedia.id}`);
	}
}

/* ----------------------------------------------------------------------------
   4. Create records from Airtable Extracts and link to related data via record_relations
---------------------------------------------------------------------------- */
const mapAirtableExtractToRecord = (extract: AirtableExtractSelect): RecordInsert => {
	return {
		title: extract.title,
		content: extract.content,
		url: extract.source,
		flags:
			extract.michelinStars > 2
				? ['favorite']
				: extract.michelinStars > 0
					? ['important']
					: undefined,
		notes: extract.notes,
		mediaCaption: extract.attachmentCaption,
		needsCuration: false,
		isPrivate: extract.publishedAt ? false : true,
		sources: ['airtable'],
		recordCreatedAt: extract.recordCreatedAt,
		recordUpdatedAt: extract.recordUpdatedAt,
		contentCreatedAt: extract.contentCreatedAt,
		contentUpdatedAt: extract.contentUpdatedAt,
	};
};

export async function createRecordsFromAirtableExtracts() {
	const extracts = await db.query.airtableExtracts.findMany({
		where: isNull(airtableExtracts.recordId),
		with: {
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
		console.log('No new Airtable extracts to process.');
		return;
	}

	console.log(`Creating ${extracts.length} records from Airtable extracts`);
	// Map to store new record IDs keyed by their Airtable extract id.
	const recordMap = new Map<string, number>();

	// Step 1: Create records (and link nonparent relations immediately)
	for (const extract of extracts) {
		const recordPayload = mapAirtableExtractToRecord(extract);
		// Insert the record into the main records table.
		const [insertedRecord] = await db
			.insert(records)
			.values(recordPayload)
			.returning({ id: records.id });
		if (!insertedRecord) {
			console.log(`Failed to create record for Airtable extract ${extract.id}`);
			continue;
		}
		// Update the Airtable extract with the new record id.
		await db
			.update(airtableExtracts)
			.set({ recordId: insertedRecord.id })
			.where(eq(airtableExtracts.id, extract.id));
		recordMap.set(extract.id, insertedRecord.id);
		console.log(`Created record ${insertedRecord.id} for Airtable extract ${extract.id}`);

		// Link media if attachments exist and have been mapped.
		extract.attachments.forEach(async (attachment) => {
			if (attachment.mediaId) {
				await db
					.insert(recordMedia)
					.values({ recordId: insertedRecord.id, mediaId: attachment.mediaId })
					.onConflictDoNothing();
			}
		});
		// Link creators if entities exist and have been mapped.
		extract.extractCreators.forEach(async (creator) => {
			if (creator.creator.indexEntryId) {
				await db
					.insert(recordCreators)
					.values({
						recordId: insertedRecord.id,
						entityId: creator.creator.indexEntryId,
						role: 'creator',
					})
					.onConflictDoNothing();
			}
		});
		// Link spaces if categories exist and have been mapped.
		extract.extractSpaces.forEach(async (space) => {
			if (space.space.indexEntryId) {
				await db
					.insert(recordCategories)
					.values({
						recordId: insertedRecord.id,
						categoryId: space.space.indexEntryId,
						type: 'file_under',
					})
					.onConflictDoNothing();
			}
		});
		// Link outgoing connections (if any)
		extract.outgoingConnections.forEach(async (connection) => {
			if (connection.toExtract.recordId) {
				await db
					.insert(recordRelations)
					.values({ sourceId: insertedRecord.id, targetId: connection.toExtract.recordId })
					.onConflictDoNothing();
			}
		});
		extract.incomingConnections.forEach(async (connection) => {
			if (connection.fromExtract.recordId) {
				await db
					.insert(recordRelations)
					.values({ sourceId: connection.fromExtract.recordId, targetId: insertedRecord.id })
					.onConflictDoNothing();
			}
		});
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
				await db
					.update(records)
					.set({ parentId: parentRecordId, childType: 'part_of' })
					.where(eq(records.id, childRecordId));
			} else {
				console.log(`Skipping linking for extract ${extract.id} due to missing parent record id.`);
			}
		}
	}
}

export async function createConnectionsBetweenRecords(updatedIds?: string[]) {
	console.log('Inserting connections between records');
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

	for (const connection of connections) {
		if (connection.fromExtract.recordId && connection.toExtract.recordId) {
			console.log(
				`Inserting connection between ${connection.fromExtract.title} (${connection.fromExtract.id}) and ${connection.toExtract.title} (${connection.toExtract.id})`
			);
			await db
				.insert(recordRelations)
				.values({
					sourceId: connection.fromExtract.recordId,
					targetId: connection.toExtract.recordId,
					type: 'related_to',
				})
				.onConflictDoNothing();
		}
	}
}
