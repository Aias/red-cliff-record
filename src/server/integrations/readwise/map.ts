import { and, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import {
	readwiseAuthors,
	readwiseDocuments,
	readwiseDocumentTags,
	readwiseTags,
	records,
	type ReadwiseAuthorSelect,
	type ReadwiseDocumentSelect,
	type ReadwiseTagSelect,
	type RecordCreatorInsert,
	type RecordInsert,
	type RecordRelationInsert,
} from '@/server/db/schema';
import {
	bulkInsertRecordCreators,
	bulkInsertRecordRelations,
	linkRecords,
	setRecordParent,
} from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';
import { mapUrl } from '../common/record-mapping';

const logger = createIntegrationLogger('readwise', 'map');

// ------------------------------------------------------------------------
// 1. Create readwise authors and upsert corresponding index entities
// ------------------------------------------------------------------------

/**
 * Creates authors from Readwise documents that don't have associated authors yet
 */
export async function createReadwiseAuthors() {
	logger.start('Creating authors from Readwise documents');

	const documentsWithoutAuthors = await db.query.readwiseDocuments.findMany({
		where: and(isNotNull(readwiseDocuments.author), isNull(readwiseDocuments.authorId)),
	});

	if (documentsWithoutAuthors.length === 0) {
		logger.skip('No documents without authors found');
		return;
	}

	logger.info(`Found ${documentsWithoutAuthors.length} documents without authors`);

	for (const document of documentsWithoutAuthors) {
		if (!document.author) {
			logger.warn(`Document ${document.id} has no author`);
			continue;
		}

		let origin: string | null = null;

		try {
			if (document.sourceUrl) {
				const url = new URL(document.sourceUrl);
				origin = url.origin;
			}
		} catch {
			logger.warn(`Skipping invalid author: ${document.author}`);
			continue;
		}

		const [newRecord] = await db
			.insert(readwiseAuthors)
			.values({
				name: document.author,
				origin,
			})
			.onConflictDoUpdate({
				target: [readwiseAuthors.name, readwiseAuthors.origin],
				set: {
					recordUpdatedAt: new Date(),
				},
			})
			.returning();

		if (!newRecord) {
			logger.error(`Failed to create author ${document.author}`);
			continue;
		}

		logger.info(`Linked document ${document.id} to author ${newRecord.id}`);

		await db
			.update(readwiseDocuments)
			.set({ authorId: newRecord.id })
			.where(eq(readwiseDocuments.id, document.id));
	}

	logger.complete(`Processed ${documentsWithoutAuthors.length} documents without authors`);
}

/**
 * Maps a Readwise author to a record
 *
 * @param author - The Readwise author to map
 * @returns A record insert object
 */
const mapReadwiseAuthorToRecord = (author: ReadwiseAuthorSelect): RecordInsert => {
	return {
		id: author.recordId ?? undefined,
		type: 'entity',
		title: author.name,
		url: author.origin ? mapUrl(author.origin) : undefined,
		sources: ['readwise'],
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
		recordCreatedAt: author.recordCreatedAt,
		recordUpdatedAt: author.recordUpdatedAt,
	};
};

/**
 * Creates records from Readwise authors that don't have associated records yet
 */
export async function createRecordsFromReadwiseAuthors() {
	logger.start('Creating records from Readwise authors');

	const authors = await db.query.readwiseAuthors.findMany({
		where: isNull(readwiseAuthors.recordId),
	});

	if (authors.length === 0) {
		logger.skip('No new or updated authors to process');
		return;
	}

	logger.info(`Found ${authors.length} unmapped Readwise authors`);

	for (const author of authors) {
		const entity = mapReadwiseAuthorToRecord(author);

		const [newEntity] = await db
			.insert(records)
			.values(entity)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });

		if (!newEntity) {
			logger.error(`Failed to create record for author ${author.name}`);
			continue;
		}

		logger.info(`Created record ${newEntity.id} for author ${author.name} (${author.id})`);

		await db
			.update(readwiseAuthors)
			.set({ recordId: newEntity.id })
			.where(eq(readwiseAuthors.id, author.id));

		logger.info(`Linked author ${author.name} to record ${newEntity.id}`);
	}

	logger.complete(`Processed ${authors.length} Readwise authors`);
}

// ------------------------------------------------------------------------
// 2. Upsert readwise tags (and build document–tag links)
// ------------------------------------------------------------------------

/**
 * Creates tags from Readwise documents and links them to documents
 *
 * @param integrationRunId - Optional integration run ID to limit processing
 * @returns A promise resolving to the processed documents
 */
export async function createReadwiseTags(integrationRunId?: number) {
	logger.start('Processing document tags');

	const documents = await db.query.readwiseDocuments.findMany({
		where: and(
			isNotNull(readwiseDocuments.tags),
			integrationRunId ? eq(readwiseDocuments.integrationRunId, integrationRunId) : undefined
		),
	});

	if (documents.length === 0) {
		logger.skip('No new or updated tags to process');
		return;
	}

	logger.info(`Found ${documents.length} documents with tags to process`);

	// Extract unique tags from all documents
	const uniqueTags = [...new Set(documents.map((document) => document.tags).flat())].filter(
		(tag): tag is string => tag !== null
	);

	// Insert or update tags
	const insertedTags = await db
		.insert(readwiseTags)
		.values(uniqueTags.map((tag) => ({ tag })))
		.onConflictDoUpdate({
			target: readwiseTags.tag,
			set: {
				recordUpdatedAt: new Date(),
			},
		})
		.returning();

	logger.info(`Upserted ${insertedTags.length} tags`);

	// Create a map of tag names to tag IDs
	const tagMap = new Map(insertedTags.map((tag) => [tag.tag, tag.id]));

	// Clear existing document-tag relationships
	logger.info('Clearing existing document tags');

	if (integrationRunId) {
		const documentIds = documents.map((document) => document.id);
		const deletedDocumentTags = await db
			.delete(readwiseDocumentTags)
			.where(inArray(readwiseDocumentTags.documentId, documentIds))
			.returning();

		logger.info(
			`Deleted ${deletedDocumentTags.length} document tags for ${documents.length} documents in integration run ${integrationRunId}`
		);
	} else {
		logger.info('No integration run id provided, deleting all document tags');
		await db.delete(readwiseDocumentTags);
	}

	// Create new document-tag relationships
	const documentTagPromises = documents.flatMap((document) => {
		if (!document.tags) return [];

		return document.tags.map(async (tag) => {
			const tagId = tagMap.get(tag);
			if (!tagId) return undefined;

			const [documentTag] = await db
				.insert(readwiseDocumentTags)
				.values({
					documentId: document.id,
					tagId,
				})
				.onConflictDoUpdate({
					target: [readwiseDocumentTags.documentId, readwiseDocumentTags.tagId],
					set: { recordUpdatedAt: new Date() },
				})
				.returning();

			return documentTag;
		});
	});

	const newDocumentTags = (await Promise.all(documentTagPromises)).filter(Boolean);
	logger.info(`Inserted ${newDocumentTags.length} document tags`);

	logger.complete(`Processed tags for ${documents.length} documents`);
	return documents;
}

// ------------------------------------------------------------------------
// 3. Create index categories from readwise tags
// ------------------------------------------------------------------------

/**
 * Maps a Readwise tag to a record
 *
 * @param tag - The Readwise tag to map
 * @returns A record insert object
 */
const mapReadwiseTagToRecord = (tag: ReadwiseTagSelect): RecordInsert => {
	return {
		id: tag.recordId ?? undefined,
		type: 'concept',
		title: tag.tag,
		sources: ['readwise'],
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
		recordCreatedAt: tag.recordCreatedAt,
		recordUpdatedAt: tag.recordUpdatedAt,
	};
};

/**
 * Creates records from Readwise tags that don't have associated records yet
 */
export async function createRecordsFromReadwiseTags() {
	logger.start('Creating records from Readwise tags');

	const tags = await db.query.readwiseTags.findMany({
		where: isNull(readwiseTags.recordId),
		with: {
			tagDocuments: {
				with: {
					document: true,
				},
			},
		},
	});

	if (tags.length === 0) {
		logger.skip('No new or updated tags to process');
		return;
	}

	logger.info(`Found ${tags.length} unmapped Readwise tags`);

	for (const tag of tags) {
		const category = mapReadwiseTagToRecord(tag);

		const [newCategory] = await db
			.insert(records)
			.values(category)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });

		if (!newCategory) {
			logger.error(`Failed to create record for tag ${tag.tag}`);
			continue;
		}

		logger.info(`Created record ${newCategory.id} for tag ${tag.tag} (${tag.id})`);

		const [updatedTag] = await db
			.update(readwiseTags)
			.set({ recordId: newCategory.id })
			.where(eq(readwiseTags.id, tag.id))
			.returning();

		if (!updatedTag) {
			logger.error(`Failed to update tag ${tag.tag} with record ${newCategory.id}`);
			continue;
		}

		logger.info(`Linked tag ${tag.tag} to record ${newCategory.id}`);

		// Link documents to tag
		for (const tagDocument of tag.tagDocuments) {
			if (tagDocument.document.recordId) {
				logger.info(`Linking tag ${tag.tag} to record ${tagDocument.document.recordId}`);
				await linkRecords(tagDocument.document.recordId, newCategory.id, 'tagged');
			}
		}
	}

	logger.complete(`Processed ${tags.length} Readwise tags`);
}

// ------------------------------------------------------------------------
// 4. Create readwise records (and auto-link parent-child as well as record → index relationships)
// ------------------------------------------------------------------------

/**
 * Type for a Readwise document with its children
 */
type ReadwiseDocumentWithChildren = ReadwiseDocumentSelect & {
	children: ReadwiseDocumentSelect[];
};

/**
 * Maps a Readwise document to a record
 *
 * @param document - The Readwise document to map
 * @returns A record insert object
 */
export const mapReadwiseDocumentToRecord = (
	document: ReadwiseDocumentWithChildren
): RecordInsert => {
	// Combine notes from children and document
	let notes = document.children
		.map((child) => (child.category === 'note' ? child.content : null))
		.filter(Boolean)
		.join('\n\n');

	if (document.notes) {
		notes = document.notes + '\n\n' + notes;
	}

	// Determine rating from tags
	let rating = 0;
	if (document.tags?.includes('⭐')) {
		rating = 1;
	}
	if (document.tags?.includes('⭐⭐')) {
		rating = 1;
	}
	if (document.tags?.includes('⭐⭐⭐')) {
		rating = 2;
	}
	if (document.tags?.includes('👎')) {
		rating = -1;
	}

	return {
		id: document.recordId ?? undefined,
		type: 'artifact',
		title: document.title || null,
		url: document.sourceUrl,
		content: document.content || null,
		summary: document.summary || null,
		notes: notes || null,
		isPrivate: false,
		needsCuration: true,
		avatarUrl: document.imageUrl,
		rating,
		sources: ['readwise'],
		recordCreatedAt: document.recordCreatedAt,
		recordUpdatedAt: document.recordUpdatedAt,
		contentCreatedAt: document.contentCreatedAt,
		contentUpdatedAt: document.contentUpdatedAt,
	};
};

/**
 * Creates records from Readwise documents that don't have associated records yet
 */
export async function createRecordsFromReadwiseDocuments() {
	logger.start('Creating records from Readwise documents');

	// Query readwise documents that need records created (skip notes-only docs)
	const documents = await db.query.readwiseDocuments.findMany({
		where: and(isNull(readwiseDocuments.recordId), ne(readwiseDocuments.category, 'note')),
		with: {
			children: true,
		},
	});

	if (documents.length === 0) {
		logger.skip('No new or updated documents to process');
		return;
	}

	logger.info(`Found ${documents.length} unmapped Readwise documents`);

	// Map to store the new record IDs keyed by the corresponding readwise document ID.
	const recordMap = new Map<string, number>();

	// Step 1: Insert each document as a record.
	for (const doc of documents) {
		// Map the document into a record insertion payload.
		const recordPayload = mapReadwiseDocumentToRecord(doc);

		// Ensure that parent ID is null (we will update this below).
		recordPayload.parentId = null;

		const [insertedRecord] = await db
			.insert(records)
			.values(recordPayload)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });

		if (!insertedRecord) {
			logger.error(`Failed to create record for readwise document ${doc.id}`);
			continue;
		}

		logger.info(
			`Created record ${insertedRecord.id} for readwise document ${doc.title || doc.content?.slice(0, 20)} (${doc.id})`
		);

		// Update the readwise document with the corresponding record id.
		await db
			.update(readwiseDocuments)
			.set({ recordId: insertedRecord.id })
			.where(eq(readwiseDocuments.id, doc.id));

		recordMap.set(doc.id, insertedRecord.id);
		logger.info(`Linked readwise document ${doc.id} to record ${insertedRecord.id}`);
	}

	// Step 2: Update the parent-child relationships.
	// For each document that has a non-null parentId, update the corresponding child record's parentId.
	for (const doc of documents) {
		if (doc.parentId) {
			const childRecordId = recordMap.get(doc.id);
			if (!childRecordId) continue;

			// Determine the parent's record id:
			// Either it was just created in this run or exists already.
			let parentRecordId = recordMap.get(doc.parentId);
			if (!parentRecordId) {
				const parentDoc = await db.query.readwiseDocuments.findFirst({
					where: eq(readwiseDocuments.id, doc.parentId),
					columns: { recordId: true },
				});
				parentRecordId = parentDoc?.recordId ?? undefined;
			}

			if (childRecordId && parentRecordId) {
				await setRecordParent(childRecordId, parentRecordId, 'part_of');
				logger.info(`Linked child record ${childRecordId} to parent record ${parentRecordId}`);
			} else {
				logger.warn(`Skipping linking for document ${doc.id} due to missing parent record id`);
			}
		}
	}

	// Step 3: Link records to index entries via recordCreators (for authors) and recordCategories (for tags).
	// Build a map for authors.
	const authorIdsSet = new Set<number>();
	for (const doc of documents) {
		if (doc.authorId) {
			authorIdsSet.add(doc.authorId);
		}
	}

	const authorIds = Array.from(authorIdsSet);
	const authorsRows = await db.query.readwiseAuthors.findMany({
		where: inArray(readwiseAuthors.id, authorIds),
		columns: { id: true, recordId: true },
	});

	const authorIndexMap = new Map<number, number>();
	for (const row of authorsRows) {
		if (row.recordId) {
			authorIndexMap.set(row.id, row.recordId);
		}
	}

	// Build a map for tags.
	const tagSet = new Set<string>();
	for (const doc of documents) {
		if (doc.tags) {
			doc.tags.forEach((tag) => tagSet.add(tag));
		}
	}

	const tagsArray = Array.from(tagSet);
	const tagRows = await db.query.readwiseTags.findMany({
		where: inArray(readwiseTags.tag, tagsArray),
		columns: { tag: true, recordId: true },
	});

	const tagIndexMap = new Map<string, number>();
	for (const row of tagRows) {
		if (row.recordId) {
			tagIndexMap.set(row.tag, row.recordId);
		}
	}

	// Bulk prepare linking arrays.
	const recordCreatorsValues: RecordCreatorInsert[] = [];
	const recordRelationsValues: RecordRelationInsert[] = [];

	for (const doc of documents) {
		const recordId = recordMap.get(doc.id);
		if (!recordId) continue;

		// Link author via recordCreators.
		if (doc.authorId && authorIndexMap.has(doc.authorId)) {
			recordCreatorsValues.push({
				recordId,
				creatorId: authorIndexMap.get(doc.authorId)!,
				creatorRole: 'creator',
			});
		}

		// Link tags via recordRelations.
		if (doc.tags && Array.isArray(doc.tags)) {
			for (const tag of doc.tags) {
				if (tagIndexMap.has(tag)) {
					recordRelationsValues.push({
						sourceId: recordId,
						targetId: tagIndexMap.get(tag)!,
						type: 'tagged',
					});
				}
			}
		}
	}

	// Bulk insert relationships
	if (recordCreatorsValues.length > 0) {
		await bulkInsertRecordCreators(recordCreatorsValues);
		logger.info(`Linked ${recordCreatorsValues.length} authors to records`);
	}

	if (recordRelationsValues.length > 0) {
		await bulkInsertRecordRelations(recordRelationsValues);
		logger.info(`Linked ${recordRelationsValues.length} tags to records`);
	}

	logger.complete(`Processed ${recordMap.size} Readwise documents`);
}
