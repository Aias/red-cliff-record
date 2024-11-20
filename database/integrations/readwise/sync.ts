import { createPgConnection } from '@schema/connections';
import { documents } from '@schema/main/readwise';
import { IntegrationType, RunType } from '@schema/main/integrations';
import { runIntegration } from '@utils/run-integration';
import type { ReadwiseArticle, ReadwiseArticlesResponse } from './types';
import { desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const db = createPgConnection();

async function getMostRecentUpdateTime(db: NodePgDatabase) {
	const mostRecent = await db
		.select({ updatedAt: documents.updatedAt })
		.from(documents)
		.orderBy(desc(documents.updatedAt))
		.limit(1);

	if (mostRecent.length > 0) {
		return mostRecent[0].updatedAt;
	}

	console.log('No existing documents found');
	return undefined;
}

async function fetchReadwiseDocuments(
	pageCursor?: string,
	updatedAfter?: Date
): Promise<ReadwiseArticlesResponse> {
	const params = new URLSearchParams();
	if (pageCursor) {
		params.append('pageCursor', pageCursor);
	}
	if (updatedAfter) {
		const afterDate = new Date(updatedAfter.getTime() + 1);
		params.append('updatedAfter', afterDate.toISOString());
	}

	const response = await fetch(`https://readwise.io/api/v3/list/?${params.toString()}`, {
		headers: {
			Authorization: `Token ${process.env.READWISE_TOKEN}`,
			'Content-Type': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch Readwise documents: ${response.statusText}`);
	}

	return response.json();
}

const cleanString = (str: string | null) => str?.replace(/\u00fe\u00ff/g, '').trim() || null;

const mapReadwiseArticleToDocument = (
	article: ReadwiseArticle,
	integrationRunId: number
): typeof documents.$inferInsert => ({
	id: article.id,
	url: article.url,
	title: cleanString(article.title),
	author: cleanString(article.author),
	source: article.source,
	category: article.category,
	location: article.location,
	tags: Object.keys(article.tags || {}),
	siteName: article.site_name,
	wordCount: article.word_count,
	publishedDate: article.published_date
		? new Date(article.published_date).toISOString().split('T')[0]
		: null,
	summary: cleanString(article.summary),
	imageUrl: article.image_url,
	content: article.content,
	sourceUrl: article.source_url,
	notes: cleanString(article.notes),
	parentId: article.parent_id,
	readingProgress: article.reading_progress.toString(),
	firstOpenedAt: article.first_opened_at ? new Date(article.first_opened_at) : null,
	lastOpenedAt: article.last_opened_at ? new Date(article.last_opened_at) : null,
	savedAt: new Date(article.saved_at),
	lastMovedAt: new Date(article.last_moved_at),
	createdAt: new Date(article.created_at),
	updatedAt: new Date(article.updated_at),
	integrationRunId
});

function sortDocumentsByHierarchy(documents: ReadwiseArticle[]): ReadwiseArticle[] {
	// Create a map of id to document for quick lookup
	const idToDocument = new Map(documents.map((doc) => [doc.id, doc]));

	// Helper function to get full ancestry chain
	function getAncestryChain(doc: ReadwiseArticle): string[] {
		const chain: string[] = [];
		let current = doc;
		while (current.parent_id) {
			const parent = idToDocument.get(current.parent_id);
			if (!parent) break; // Handle case where parent is not in our dataset
			chain.push(current.parent_id);
			current = parent;
		}
		return chain;
	}

	return [...documents].sort((a, b) => {
		const aAncestry = getAncestryChain(a);
		const bAncestry = getAncestryChain(b);

		// First sort by ancestry chain length
		if (aAncestry.length !== bAncestry.length) {
			return aAncestry.length - bAncestry.length;
		}

		// If same hierarchy level, sort by creation date
		return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
	});
}

async function syncReadwiseDocuments(integrationRunId: number): Promise<number> {
	const lastUpdateTime = await getMostRecentUpdateTime(db);

	const allDocuments: ReadwiseArticle[] = [];
	let nextPageCursor: string | null = null;

	do {
		const response = await fetchReadwiseDocuments(
			nextPageCursor ?? undefined,
			lastUpdateTime ?? undefined
		);
		allDocuments.push(...response.results);
		nextPageCursor = response.nextPageCursor;
	} while (nextPageCursor);

	if (allDocuments.length === 0) {
		console.log('No new or updated documents to process');
		return 0;
	}

	console.log(`Retrieved ${allDocuments.length} documents to process`);

	// Replace the existing sort with our new hierarchical sort
	const sortedDocuments = sortDocumentsByHierarchy(allDocuments);

	let successCount = 0;

	for (const doc of sortedDocuments) {
		try {
			const mappedDoc = mapReadwiseArticleToDocument(doc, integrationRunId);

			await db.insert(documents).values(mappedDoc).onConflictDoUpdate({
				target: documents.id,
				set: mappedDoc
			});

			successCount++;
		} catch (error) {
			console.error('Error processing document:', {
				document: doc,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	console.log(`Successfully processed ${successCount} out of ${allDocuments.length} documents`);
	return successCount;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.READWISE, syncReadwiseDocuments, RunType.INCREMENTAL);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncReadwiseDocuments };