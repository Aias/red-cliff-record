import { createPgConnection, type PgConnection } from '../../connections';
import { readwiseDocuments, type NewReadwiseDocument } from '../readwise/schema';
import { IntegrationType } from '../../operations/types';
import { runIntegration } from '../../utils/run-integration';
import { ReadwiseArticlesResponseSchema } from './types';
import type { ReadwiseArticle, ReadwiseArticlesResponse } from './types';
import { desc } from 'drizzle-orm';
import { loadEnv } from '@rcr/lib/env';

loadEnv();

const db = createPgConnection();

async function getMostRecentUpdateTime(db: PgConnection) {
	const mostRecent = await db.query.readwiseDocuments.findFirst({
		columns: {
			contentUpdatedAt: true,
		},
		orderBy: desc(readwiseDocuments.contentUpdatedAt),
	});

	if (mostRecent) {
		console.log(
			`Last known readwise date: ${mostRecent.contentUpdatedAt?.toLocaleString() ?? 'none'}`
		);
		return mostRecent.contentUpdatedAt;
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
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		if (response.status === 429) {
			// Get retry delay from header, default to 60 seconds if not provided
			const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
			console.warn(`Rate limit hit, waiting ${retryAfter} seconds before retrying...`);
			await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
			// Retry the request
			return fetchReadwiseDocuments(pageCursor, updatedAfter);
		}
		throw new Error(`Failed to fetch Readwise documents: ${response.statusText}`);
	}

	const data = await response.json();
	return ReadwiseArticlesResponseSchema.parse(data);
}

const mapReadwiseArticleToDocument = (
	article: ReadwiseArticle,
	integrationRunId: number
): NewReadwiseDocument => ({
	id: article.id,
	parentId: article.parent_id,
	url: article.url,
	title: article.title,
	author: article.author,
	source: article.source,
	category: article.category,
	location: article.location,
	tags: article.tags,
	siteName: article.site_name,
	wordCount: article.word_count,
	summary: article.summary,
	content: article.content,
	notes: article.notes,
	imageUrl: article.image_url,
	sourceUrl: article.source_url,
	readingProgress: article.reading_progress.toString(),
	firstOpenedAt: article.first_opened_at,
	lastOpenedAt: article.last_opened_at,
	savedAt: article.saved_at,
	lastMovedAt: article.last_moved_at,
	publishedDate: article.published_date ? article.published_date.toISOString().split('T')[0] : null,
	contentCreatedAt: article.created_at,
	contentUpdatedAt: article.updated_at,
	integrationRunId,
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

			await db
				.insert(readwiseDocuments)
				.values(mappedDoc)
				.onConflictDoUpdate({
					target: readwiseDocuments.id,
					set: { ...mappedDoc, updatedAt: new Date() },
				});

			successCount++;
		} catch (error) {
			console.error('Error processing document:', {
				document: doc,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	console.log(`Successfully processed ${successCount} out of ${allDocuments.length} documents`);
	return successCount;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.enum.readwise, syncReadwiseDocuments);
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
