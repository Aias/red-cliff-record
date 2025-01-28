import OpenAI from 'openai';
import { db } from '~/server/db/connections';
import { embeddings } from '~/server/db/schema/main';

const openai = new OpenAI();

export interface EmbeddableDocument {
	id: string | number;
	getEmbeddingText(): string;
	tableName: string;
	embeddingIdColumn: string;
}

export async function createEmbedding(text: string, dimensions: number = 768) {
	const output = await openai.embeddings.create({
		input: text,
		model: 'text-embedding-3-large',
		dimensions,
	});

	return output.data[0]?.embedding;
}

export async function createDocumentEmbedding(
	doc: EmbeddableDocument,
	maxInputLength: number = 8192,
	currentIndex: number,
	totalCount: number
) {
	try {
		const textToEmbed = doc.getEmbeddingText().replace(/\s+/g, ' ').slice(0, maxInputLength);

		console.log(`Creating embedding ${currentIndex + 1}/${totalCount} for:`, textToEmbed);

		const embeddingVector = await createEmbedding(textToEmbed);

		if (!embeddingVector) {
			throw new Error('No embedding received');
		}

		const [embedding] = await db
			.insert(embeddings)
			.values({
				embedding: embeddingVector,
			})
			.returning();

		if (!embedding) {
			throw new Error('Failed to create embedding');
		}

		// Use dynamic SQL to update the correct table
		await db.execute(
			`UPDATE ${doc.tableName} SET ${doc.embeddingIdColumn} = ${embedding.id} WHERE id = ${typeof doc.id === 'string' ? `'${doc.id}'` : doc.id}`
		);

		console.log(
			`✓ Created embedding ${currentIndex + 1}/${totalCount} for ${doc.tableName} document ${doc.id}`
		);
		return true;
	} catch (error) {
		console.error(
			`✗ Error creating embedding ${currentIndex + 1}/${totalCount} for ${doc.tableName} document ${doc.id}:`,
			error
		);
		return false;
	}
}

export async function syncEmbeddings<T extends EmbeddableDocument>(
	getDocumentsWithoutEmbeddings: () => Promise<T[]>,
	integrationName: string
): Promise<number> {
	const documents = await getDocumentsWithoutEmbeddings();
	console.log(`Found ${documents.length} documents without embeddings for ${integrationName}`);

	let successCount = 0;
	let failureCount = 0;
	const batchSize = 50;

	for (let i = 0; i < documents.length; i += batchSize) {
		const batch = documents.slice(i, i + batchSize);
		const batchNumber = Math.floor(i / batchSize) + 1;
		const totalBatches = Math.ceil(documents.length / batchSize);
		console.log(`Processing batch ${batchNumber} of ${totalBatches} (${batch.length} documents)`);

		const results = await Promise.allSettled(
			batch.map(async (doc, index) =>
				createDocumentEmbedding(doc, 8192, i + index, documents.length)
			)
		);

		const batchSuccesses = results.filter((r) => r.status === 'fulfilled' && r.value).length;
		const batchFailures = batch.length - batchSuccesses;

		successCount += batchSuccesses;
		failureCount += batchFailures;

		console.log(
			`Batch ${batchNumber}/${totalBatches} complete: ${batchSuccesses} succeeded, ${batchFailures} failed`
		);
		console.log(
			`Running total: ${successCount} succeeded, ${failureCount} failed (${Math.round((successCount / documents.length) * 100)}% complete)`
		);
	}

	console.log(`Finished processing all documents for ${integrationName}`);
	console.log(
		`Final results: ${successCount} succeeded, ${failureCount} failed out of ${documents.length} total (${Math.round((successCount / documents.length) * 100)}% success rate)`
	);
	return successCount;
}

/*
WITH linked_embeddings AS (
  SELECT e.embedding 
  FROM integrations.TABLENAME src
  LEFT JOIN embeddings e ON e.id = src.embedding_id
  WHERE src.id = 'RECORDID'
)
SELECT
  1 - (e.embedding <=> (SELECT embedding FROM linked_embeddings)) as similarity,
	src.*
FROM 
  embeddings e
  JOIN integrations.TABLENAME src ON src.embedding_id = e.id
ORDER BY 
  e.embedding <=> (SELECT embedding FROM linked_embeddings)
LIMIT 50;
*/
