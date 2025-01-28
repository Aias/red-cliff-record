import { and, eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '~/server/db/connections';
import { readwiseDocuments } from '~/server/db/schema/integrations';
import { embeddings } from '~/server/db/schema/main';
import { runIntegration } from '../common/run-integration';

const openai = new OpenAI();

async function getDocumentsWithoutEmbeddings() {
	// Get documents that don't have corresponding embeddings
	const docs = await db.query.readwiseDocuments.findMany({
		with: {
			embedding: true,
			children: true,
		},
		where: (fields, { isNull }) => and(isNull(fields.embeddingId), isNull(fields.parentId)),
		orderBy: (fields, { asc }) => [asc(fields.contentCreatedAt)],
	});

	return docs;
}

type InputDocument = Awaited<ReturnType<typeof getDocumentsWithoutEmbeddings>>[number];

async function createEmbedding(text: string, dimensions: number = 768) {
	const output = await openai.embeddings.create({
		input: text,
		model: 'text-embedding-3-large',
		dimensions,
	});

	return output.data[0]?.embedding;
}

async function createDocumentEmbedding(doc: InputDocument, maxInputLength: number = 8192) {
	try {
		// Format a single document's content
		const formatDocument = (doc: Partial<InputDocument>) =>
			[
				`Title: ${doc.title || '—'}`,
				`Author: ${doc.author || '—'}`,
				`Site: ${doc.siteName || '—'}`,
				`Summary: ${doc.summary || '—'}`,
				`Content: ${doc.content || '—'}`,
				`Note: ${doc.notes || '—'}`,
				`Tags: ${doc.tags?.join(', ') || '—'}`,
			].join(' // ');

		// Create a combined text representation of parent and children
		const textParts = ['# Main Document', formatDocument(doc)];

		// Add children if they exist
		if (doc.children?.length) {
			textParts.push(
				'',
				'# Child Documents',
				...doc.children.map((child, index) => `Child ${index + 1}: ${formatDocument(child)}`)
			);
		}

		const textToEmbed = textParts
			.join('\n')
			.replace(/\s+/g, ' ') // Normalize whitespace
			.slice(0, maxInputLength);

		console.log('Creating embedding for: ', textToEmbed);

		// Generate embedding
		const embeddingVector = await createEmbedding(textToEmbed);

		console.log('Embedding vector:', embeddingVector);

		if (!embeddingVector) {
			throw new Error('No embedding received');
		}

		// Store in database
		const [embedding] = await db
			.insert(embeddings)
			.values({
				embedding: embeddingVector,
			})
			.returning();

		if (!embedding) {
			throw new Error('Failed to create embedding');
		}

		await db
			.update(readwiseDocuments)
			.set({ embeddingId: embedding.id })
			.where(eq(readwiseDocuments.id, doc.id));

		console.log(`Created embedding for document ${doc.id}`);
	} catch (error) {
		console.error(`Error creating embedding for document ${doc.id}:`, error);
	}
}

async function syncReadwiseEmbeddings(): Promise<number> {
	await db.delete(embeddings); // Clear existing embeddings.
	const documents = await getDocumentsWithoutEmbeddings();
	console.log(`Found ${documents.length} parent documents without embeddings`);

	let successCount = 0;
	let failureCount = 0;
	const batchSize = 50;

	for (let i = 0; i < documents.length; i += batchSize) {
		const batch = documents.slice(i, i + batchSize);
		console.log(
			`Processing batch ${i / batchSize + 1} of ${Math.ceil(documents.length / batchSize)}`
		);

		const results = await Promise.allSettled(
			batch.map(async (doc) => {
				try {
					await createDocumentEmbedding(doc);
					return true;
				} catch (error) {
					console.error('Error processing document:', {
						document: doc,
						error: error instanceof Error ? error.message : String(error),
					});
					return false;
				}
			})
		);

		const batchSuccesses = results.filter((r) => r.status === 'fulfilled' && r.value).length;
		const batchFailures = batch.length - batchSuccesses;

		successCount += batchSuccesses;
		failureCount += batchFailures;

		console.log(`Batch complete: ${batchSuccesses} succeeded, ${batchFailures} failed`);
		console.log(`Running total: ${successCount} succeeded, ${failureCount} failed`);
	}

	console.log(`Finished processing all documents`);
	console.log(
		`Final results: ${successCount} succeeded, ${failureCount} failed out of ${documents.length} total`
	);
	return successCount;
}

const main = async () => {
	try {
		await runIntegration('embeddings', syncReadwiseEmbeddings);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embeddings.ts')) {
	main();
}

export { main as syncReadwiseEmbeddings };

/*
WITH document_embedding AS (
  SELECT e.embedding 
  FROM integrations.readwise_documents rd
  LEFT JOIN embeddings e ON e.id = rd.embedding_id
  WHERE rd.id = '01jckba7sc4cmvsfsw5sjb1ws2'
)
SELECT 
  rd.id,
  rd.title,
  rd.content,
  rd.tags,
  rd.summary,
  rd.author,
  rd.site_name,
  1 - (e.embedding <=> (SELECT embedding FROM document_embedding)) as similarity
FROM 
  embeddings e
  JOIN integrations.readwise_documents rd ON rd.embedding_id = e.id
WHERE 
  rd.id != '01jckba7sc4cmvsfsw5sjb1ws2'
ORDER BY 
  e.embedding <=> (SELECT embedding FROM document_embedding)
LIMIT 50;
*/
