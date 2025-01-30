import { eq } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	readwiseDocuments,
	type ReadwiseDocumentSelect,
} from '~/server/db/schema/integrations/readwise';
import { createEmbedding, type EmbeddingType } from '~/server/services/ai/create-embedding';
import { runIntegration } from '../common/run-integration';

// Document implementation
class ReadwiseDocument implements EmbeddingType {
	constructor(
		private doc: ReadwiseDocumentSelect & {
			children?: ReadwiseDocumentSelect[];
		}
	) {}

	private formatDocument(doc: Partial<ReadwiseDocumentSelect>) {
		return [
			`Title: ${doc.title || '—'}`,
			`Author: ${doc.author || '—'}`,
			`Site: ${doc.siteName || '—'}`,
			`Summary: ${doc.summary || '—'}`,
			`Content: ${doc.content || '—'}`,
			`Notes: ${doc.notes || '—'}`,
			`Tags: ${doc.tags?.join(', ') || '—'}`,
		].join(' // ');
	}

	getEmbeddingText(): string {
		const textParts = ['# Main Document', this.formatDocument(this.doc)];

		// Add children if they exist
		if (this.doc.children?.length) {
			textParts.push(
				'',
				'# Child Documents',
				...this.doc.children.map(
					(child, index) => `Child ${index + 1}: ${this.formatDocument(child)}`
				)
			);
		}

		return textParts.join('\n');
	}
}

// Fetch and update function
async function updateDocumentEmbeddings() {
	const docs = await db.query.readwiseDocuments.findMany({
		with: {
			children: true,
		},
		where: (fields, { isNull, and }) => and(isNull(fields.embedding), isNull(fields.parentId)),
		orderBy: (fields, { asc }) => [asc(fields.contentCreatedAt)],
	});

	let count = 0;
	for (const doc of docs) {
		const embeddingText = new ReadwiseDocument(doc).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db.update(readwiseDocuments).set({ embedding }).where(eq(readwiseDocuments.id, doc.id));
		count++;
	}
	return count;
}

// Sync function
async function syncReadwiseEmbeddings(): Promise<number> {
	return await updateDocumentEmbeddings();
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

export { syncReadwiseEmbeddings };
