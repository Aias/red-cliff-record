import { and, eq, inArray, ne } from 'drizzle-orm';
import { isNotNull } from 'drizzle-orm';
import { isNull } from 'drizzle-orm';
import { validateAndFormatUrl } from '~/app/lib/formatting';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { db } from '~/server/db/connections';
import {
	indices,
	media,
	readwiseAuthors,
	readwiseDocuments,
	readwiseDocumentTags,
	readwiseTags,
	recordCategories,
	recordCreators,
	recordMedia,
	records,
	type Flag,
	type IndicesInsert,
	type MediaInsert,
	type ReadwiseAuthorSelect,
	type ReadwiseDocumentSelect,
	type ReadwiseTagSelect,
	type RecordCategoryInsert,
	type RecordCreatorInsert,
	type RecordInsert,
} from '~/server/db/schema';

// ------------------------------------------------------------------------
// 1. Create readwise authors and upsert corresponding index entities
// ------------------------------------------------------------------------

export async function createReadwiseAuthors() {
	const documentsWithoutAuthors = await db.query.readwiseDocuments.findMany({
		where: and(isNotNull(readwiseDocuments.author), isNull(readwiseDocuments.authorId)),
	});

	if (documentsWithoutAuthors.length === 0) {
		console.log('No documents without authors found');
		return;
	}

	console.log(`Found ${documentsWithoutAuthors.length} documents without authors`);

	for (const document of documentsWithoutAuthors) {
		if (!document.author) {
			console.log(`Document ${document.id} has no author`);
			continue;
		}

		let origin: string | null = null;

		try {
			if (document.sourceUrl) {
				const url = new URL(document.sourceUrl);
				origin = url.origin;
			}
		} catch {
			console.log(`Skipping invalid author: ${document.author}`);
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
			console.log(`Failed to create author ${document.author}`);
			continue;
		}
		console.log(`Linked document ${document.id} to author ${newRecord.id}`);
		await db
			.update(readwiseDocuments)
			.set({ authorId: newRecord.id })
			.where(eq(readwiseDocuments.id, document.id));
	}
}

const mapReadwiseAuthorToEntity = (author: ReadwiseAuthorSelect): IndicesInsert => {
	let canonicalUrl: string | null = null;
	if (author.origin) {
		const { success, data } = validateAndFormatUrl(author.origin, true);
		if (success) {
			canonicalUrl = data;
		}
	}
	return {
		name: author.name,
		mainType: 'entity',
		sources: ['readwise'],
		canonicalUrl,
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: author.recordCreatedAt,
		recordUpdatedAt: author.recordUpdatedAt,
	};
};

export async function createEntitiesFromReadwiseAuthors() {
	const authors = await db.query.readwiseAuthors.findMany({
		where: isNull(readwiseAuthors.indexEntryId),
	});
	if (authors.length === 0) {
		console.log('No new or updated authors to process.');
		return;
	}

	console.log(`Processing ${authors.length} readwise authors into index entities...`);

	for (const author of authors) {
		const entity = mapReadwiseAuthorToEntity(author);
		const [newEntity] = await db
			.insert(indices)
			.values(entity)
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: indices.id });
		if (!newEntity) {
			console.log(`Failed to create index entity for author ${author.name}`);
			continue;
		}
		await db
			.update(readwiseAuthors)
			.set({ indexEntryId: newEntity.id })
			.where(eq(readwiseAuthors.id, author.id));
		console.log(`Linked author ${author.name} to index entity ${newEntity.id}`);
	}
}

// ------------------------------------------------------------------------
// 2. Upsert readwise tags (and build document–tag links)
// ------------------------------------------------------------------------

export async function createReadwiseTags(integrationRunId?: number) {
	console.log('Processing document tags...');
	const documents = await db.query.readwiseDocuments.findMany({
		where: and(
			isNotNull(readwiseDocuments.tags),
			integrationRunId ? eq(readwiseDocuments.integrationRunId, integrationRunId) : undefined
		),
	});
	if (documents.length === 0) {
		console.log('No new or updated documents to process.');
		return;
	}

	const uniqueTags = [...new Set(documents.map((document) => document.tags).flat())].filter(
		(tag): tag is string => tag !== null
	);

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
	console.log(`Upserted ${insertedTags.length} tags.`);
	const tagMap = new Map(insertedTags.map((tag) => [tag.tag, tag.id]));

	console.log('Clearing existing document tags...');
	if (integrationRunId) {
		const documentIds = documents.map((document) => document.id);
		const deletedDocumentTags = await db
			.delete(readwiseDocumentTags)
			.where(inArray(readwiseDocumentTags.documentId, documentIds))
			.returning();
		console.log(
			`Deleted ${deletedDocumentTags.length} document tags for ${documents.length} documents in integration run ${integrationRunId}.`
		);
	} else {
		await db.delete(readwiseDocumentTags);
		console.log(`Deleted all document tags.`);
	}

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
	console.log(`Inserted ${newDocumentTags.length} document tags.`);
	return documents;
}

// ------------------------------------------------------------------------
// 3. Create index categories from readwise tags
// ------------------------------------------------------------------------

const mapReadwiseTagToCategory = (tag: ReadwiseTagSelect): IndicesInsert => {
	return {
		name: tag.tag,
		mainType: 'category',
		sources: ['readwise'],
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: tag.recordCreatedAt,
		recordUpdatedAt: tag.recordUpdatedAt,
	};
};

export async function createCategoriesFromReadwiseTags() {
	const tags = await db.query.readwiseTags.findMany({
		where: isNull(readwiseTags.indexEntryId),
	});
	if (tags.length === 0) {
		console.log('No new or updated tags to process.');
		return;
	}

	console.log(`Processing ${tags.length} readwise tags into index categories...`);
	for (const tag of tags) {
		const category = mapReadwiseTagToCategory(tag);
		const [newCategory] = await db
			.insert(indices)
			.values(category)
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: indices.id });
		if (!newCategory) {
			console.log(`Failed to create index category for tag ${tag.tag}`);
			continue;
		}
		await db
			.update(readwiseTags)
			.set({ indexEntryId: newCategory.id })
			.where(eq(readwiseTags.id, tag.id));
		console.log(`Linked tag ${tag.tag} to index category ${newCategory.id}`);
	}
}

// ------------------------------------------------------------------------
// 4. Create readwise records (and auto-link parent-child as well as record → index relationships)
// ------------------------------------------------------------------------

type ReadwiseDocumentWithChildren = ReadwiseDocumentSelect & {
	children: ReadwiseDocumentSelect[];
};

export const mapReadwiseDocumentToRecord = (
	document: ReadwiseDocumentWithChildren
): RecordInsert => {
	let notes = document.children
		.map((child) => (child.category === 'note' ? child.content : null))
		.filter(Boolean)
		.join('\n\n');
	if (document.notes) {
		notes = document.notes + '\n\n' + notes;
	}
	const flags: Flag[] = [];
	if (document.tags?.includes('⭐')) {
		flags.push('important');
	}
	if (document.tags?.includes('⭐⭐⭐')) {
		flags.push('favorite');
	}
	if (document.tags?.includes('👎')) {
		flags.push('disagree');
	}
	if (document.tags?.includes('📷')) {
		flags.push('follow_up');
	}
	return {
		title: document.title,
		url: document.sourceUrl,
		content: document.content,
		summary: document.summary,
		notes: notes || null,
		isPrivate: false,
		needsCuration: true,
		flags: flags.length > 0 ? flags : null,
		sources: ['readwise'],
		recordCreatedAt: document.recordCreatedAt,
		recordUpdatedAt: document.recordUpdatedAt,
		contentCreatedAt: document.contentCreatedAt,
		contentUpdatedAt: document.contentUpdatedAt,
	};
};

export async function createRecordsFromReadwiseDocuments() {
	// Query readwise documents that need records created (skip notes-only docs)
	const documents = await db.query.readwiseDocuments.findMany({
		where: and(isNull(readwiseDocuments.recordId), ne(readwiseDocuments.category, 'note')),
		with: {
			children: true,
		},
	});
	if (documents.length === 0) {
		console.log('No new or updated documents to process.');
		return;
	}
	console.log(`Creating ${documents.length} records from readwise documents`);

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
			.returning({ id: records.id });
		if (!insertedRecord) {
			console.log(`Failed to create record for readwise document ${doc.id}`);
			continue;
		}
		// If the document has already been mapped to a media item, link it.
		if (doc.mediaId) {
			await db
				.insert(recordMedia)
				.values({ recordId: insertedRecord.id, mediaId: doc.mediaId })
				.onConflictDoNothing();
		}
		// Update the readwise document with the corresponding record id.
		await db
			.update(readwiseDocuments)
			.set({ recordId: insertedRecord.id })
			.where(eq(readwiseDocuments.id, doc.id));
		recordMap.set(doc.id, insertedRecord.id);
		console.log(`Created record ${insertedRecord.id} for readwise document ${doc.id}`);
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
				await db
					.update(records)
					.set({ parentId: parentRecordId, childType: 'part_of' })
					.where(eq(records.id, childRecordId));
				console.log(`Linked child record ${childRecordId} to parent record ${parentRecordId}`);
			} else {
				console.log(`Skipping linking for document ${doc.id} due to missing parent record id.`);
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
		columns: { id: true, indexEntryId: true },
	});
	const authorIndexMap = new Map<number, number>();
	for (const row of authorsRows) {
		if (row.indexEntryId) {
			authorIndexMap.set(row.id, row.indexEntryId);
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
		columns: { tag: true, indexEntryId: true },
	});
	const tagIndexMap = new Map<string, number>();
	for (const row of tagRows) {
		if (row.indexEntryId) {
			tagIndexMap.set(row.tag, row.indexEntryId);
		}
	}

	// Bulk prepare linking arrays.
	const recordCreatorsValues: RecordCreatorInsert[] = [];
	const recordCategoriesValues: RecordCategoryInsert[] = [];
	for (const doc of documents) {
		const recordId = recordMap.get(doc.id);
		if (!recordId) continue;
		// Link author via recordCreators.
		if (doc.authorId && authorIndexMap.has(doc.authorId)) {
			recordCreatorsValues.push({
				recordId,
				entityId: authorIndexMap.get(doc.authorId)!,
				role: 'creator',
				order: 'a0',
				recordCreatedAt: new Date(),
				recordUpdatedAt: new Date(),
			});
		}
		// Link tags via recordCategories.
		if (doc.tags && Array.isArray(doc.tags)) {
			for (const tag of doc.tags) {
				if (tagIndexMap.has(tag)) {
					recordCategoriesValues.push({
						recordId,
						categoryId: tagIndexMap.get(tag)!,
						type: 'file_under',
						recordCreatedAt: new Date(),
						recordUpdatedAt: new Date(),
					});
				}
			}
		}
	}

	if (recordCreatorsValues.length > 0) {
		await db
			.insert(recordCreators)
			.values(recordCreatorsValues)
			.onConflictDoUpdate({
				target: [recordCreators.recordId, recordCreators.entityId, recordCreators.role],
				set: { recordUpdatedAt: new Date() },
			});
		console.log(`Linked ${recordCreatorsValues.length} authors to records.`);
	}
	if (recordCategoriesValues.length > 0) {
		await db.insert(recordCategories).values(recordCategoriesValues).onConflictDoNothing();
		console.log(`Linked ${recordCategoriesValues.length} tags to records.`);
	}

	console.log(`Processed ${recordMap.size} records.`);
}

// ------------------------------------------------------------------------
// 5. Create media from readwise documents
// ------------------------------------------------------------------------

export async function mapReadwiseDocumentToMedia(
	document: ReadwiseDocumentSelect
): Promise<MediaInsert | null> {
	if (!document.imageUrl) return null;
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(document.imageUrl);
		return {
			url: document.imageUrl,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			sources: ['readwise'],
			isPrivate: false,
			needsCuration: true,
			recordCreatedAt: document.recordCreatedAt,
			recordUpdatedAt: document.recordUpdatedAt,
			contentCreatedAt: document.contentCreatedAt,
			contentUpdatedAt: document.contentUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', document.imageUrl, error);
		return null;
	}
}

export async function createMediaFromReadwiseDocuments() {
	const documentsWithImages = await db.query.readwiseDocuments.findMany({
		where: and(isNull(readwiseDocuments.mediaId), isNotNull(readwiseDocuments.imageUrl)),
	});
	if (documentsWithImages.length === 0) {
		console.log('No new or updated documents to process.');
		return;
	}
	console.log(`Creating ${documentsWithImages.length} media from readwise documents`);
	for (const item of documentsWithImages) {
		const mediaItem = await mapReadwiseDocumentToMedia(item);
		if (!mediaItem) {
			console.log(`Failed to create media for document ${item.id}`);
			await db
				.update(readwiseDocuments)
				.set({ imageUrl: null })
				.where(eq(readwiseDocuments.id, item.id));
			continue;
		}
		console.log(`Creating media for ${mediaItem.url}`);
		const [newMedia] = await db
			.insert(media)
			.values(mediaItem)
			.onConflictDoUpdate({
				target: [media.url],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: media.id });
		if (!newMedia) {
			throw new Error('Failed to create media');
		}
		await db
			.update(readwiseDocuments)
			.set({ mediaId: newMedia.id })
			.where(eq(readwiseDocuments.id, item.id));
		if (item.recordId) {
			console.log(`Linking media ${newMedia.id} to record ${item.recordId}`);
			await db
				.insert(recordMedia)
				.values({
					recordId: item.recordId,
					mediaId: newMedia.id,
				})
				.onConflictDoNothing();
		}
	}
}
