import { and, eq, inArray, ne } from 'drizzle-orm';
import { isNotNull } from 'drizzle-orm';
import { isNull } from 'drizzle-orm';
import { validateAndFormatUrl } from '@/app/lib/formatting';
import { db } from '@/server/db/connections';
import {
	readwiseAuthors,
	readwiseDocuments,
	readwiseDocumentTags,
	readwiseTags,
	recordCreators,
	recordRelations,
	records,
	type ReadwiseAuthorSelect,
	type ReadwiseDocumentSelect,
	type ReadwiseTagSelect,
	type RecordCreatorInsert,
	type RecordInsert,
	type RecordRelationInsert,
} from '@/server/db/schema';

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

const mapReadwiseAuthorToRecord = (author: ReadwiseAuthorSelect): RecordInsert => {
	let canonicalUrl: string | null = null;
	if (author.origin) {
		const { success, data } = validateAndFormatUrl(author.origin, true);
		if (success) {
			canonicalUrl = data;
		}
	}
	return {
		id: author.recordId ?? undefined,
		type: 'entity',
		title: author.name,
		sources: ['readwise'],
		url: canonicalUrl,
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
		recordCreatedAt: author.recordCreatedAt,
		recordUpdatedAt: author.recordUpdatedAt,
	};
};

export async function createRecordsFromReadwiseAuthors() {
	const authors = await db.query.readwiseAuthors.findMany({
		where: isNull(readwiseAuthors.recordId),
	});
	if (authors.length === 0) {
		console.log('No new or updated authors to process.');
		return;
	}

	console.log(`Processing ${authors.length} readwise authors into records...`);

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
			console.log(`Failed to create record for author ${author.name}`);
			continue;
		}
		console.log(`Created record ${newEntity.id} for author ${author.name} (${author.id})`);
		await db
			.update(readwiseAuthors)
			.set({ recordId: newEntity.id })
			.where(eq(readwiseAuthors.id, author.id));
		console.log(`Linked author ${author.name} to record ${newEntity.id}`);
	}
}

// ------------------------------------------------------------------------
// 2. Upsert readwise tags (and build document–tag links)
// ------------------------------------------------------------------------

export async function createReadwiseTags(integrationRunId?: number) {
	console.log('Processing document tags for integration run', integrationRunId);
	const documents = await db.query.readwiseDocuments.findMany({
		where: and(
			isNotNull(readwiseDocuments.tags),
			integrationRunId ? eq(readwiseDocuments.integrationRunId, integrationRunId) : undefined
		),
	});
	if (documents.length === 0) {
		console.log('No new or updated tags to process.');
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
		console.log(`No integration run id provided, deleting all document tags.`);
		await db.delete(readwiseDocumentTags);
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

export async function createRecordsFromReadwiseTags() {
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
		console.log('No new or updated tags to process.');
		return;
	}

	console.log(`Processing ${tags.length} readwise tags into records...`);
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
			console.error(`Failed to create record for tag ${tag.tag}`);
			continue;
		}
		console.log(`Created record ${newCategory.id} for tag ${tag.tag} (${tag.id})`);
		const [updatedTag] = await db
			.update(readwiseTags)
			.set({ recordId: newCategory.id })
			.where(eq(readwiseTags.id, tag.id))
			.returning();
		if (!updatedTag) {
			console.error(`Failed to update tag ${tag.tag} with record ${newCategory.id}`);
			continue;
		}
		console.log(`Linked tag ${tag.tag} to record ${newCategory.id}`);
		for (const tagDocument of tag.tagDocuments) {
			if (tagDocument.document.recordId) {
				console.log(`Linking tag ${tag.tag} to record ${tagDocument.document.recordId}`);
				await db
					.insert(recordRelations)
					.values({
						sourceId: tagDocument.document.recordId,
						targetId: newCategory.id,
						type: 'tagged',
					})
					.onConflictDoUpdate({
						target: [recordRelations.sourceId, recordRelations.targetId, recordRelations.type],
						set: { recordUpdatedAt: new Date() },
					});
			}
		}
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

	let rating: number = 0;
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
		rating: rating,
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
		console.log(
			`Created record ${insertedRecord.id} for readwise document ${doc.title || doc.content?.slice(0, 20)} (${doc.id})`
		);
		// Update the readwise document with the corresponding record id.
		await db
			.update(readwiseDocuments)
			.set({ recordId: insertedRecord.id })
			.where(eq(readwiseDocuments.id, doc.id));
		recordMap.set(doc.id, insertedRecord.id);
		console.log(`Linked readwise document ${doc.id} to record ${insertedRecord.id}`);
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

	if (recordCreatorsValues.length > 0) {
		await db.insert(recordCreators).values(recordCreatorsValues).onConflictDoNothing();
		console.log(`Linked ${recordCreatorsValues.length} authors to records.`);
	}
	if (recordRelationsValues.length > 0) {
		await db.insert(recordRelations).values(recordRelationsValues).onConflictDoNothing();
		console.log(`Linked ${recordRelationsValues.length} tags to records.`);
	}

	console.log(`Processed ${recordMap.size} records.`);
}
