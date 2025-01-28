import { db } from '~/server/db/connections';
import { type readwiseDocuments } from '~/server/db/schema/integrations/readwise';
import { syncEmbeddings, type EmbeddableDocument } from '../common/embeddings';
import { runIntegration } from '../common/run-integration';

// Document implementation
class ReadwiseDocument implements EmbeddableDocument {
	constructor(
		private doc: typeof readwiseDocuments.$inferSelect & {
			children?: (typeof readwiseDocuments.$inferSelect)[];
		}
	) {}

	get id() {
		return this.doc.id;
	}

	get tableName() {
		return 'integrations.readwise_documents';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

	private formatDocument(doc: Partial<typeof readwiseDocuments.$inferSelect>) {
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

// Fetch function
async function getDocumentsWithoutEmbeddings() {
	const docs = await db.query.readwiseDocuments.findMany({
		with: {
			children: true,
		},
		where: (fields, { isNull, and }) => and(isNull(fields.embeddingId), isNull(fields.parentId)),
		orderBy: (fields, { asc }) => [asc(fields.contentCreatedAt)],
	});
	return docs.map((doc) => new ReadwiseDocument(doc));
}

// Sync function
async function syncReadwiseEmbeddings(): Promise<number> {
	const finalCount = await syncEmbeddings(getDocumentsWithoutEmbeddings, 'readwise-documents');

	return finalCount;
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
