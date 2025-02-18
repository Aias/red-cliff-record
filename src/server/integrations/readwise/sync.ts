import { desc } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { readwiseDocuments, type ReadwiseDocumentInsert } from '@/server/db/schema/readwise';
import { runIntegration } from '../common/run-integration';
import {
	createCategoriesFromReadwiseTags,
	createEntitiesFromReadwiseAuthors,
	createMediaFromReadwiseDocuments,
	createReadwiseAuthors,
	createReadwiseTags,
	createRecordsFromReadwiseDocuments,
} from './map';
import {
	ReadwiseArticlesResponseSchema,
	type ReadwiseArticle,
	type ReadwiseArticlesResponse,
} from './types';

async function getMostRecentUpdateTime() {
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
	params.append('withHtmlContent', 'true');
	const response = await fetch(`https://readwise.io/api/v3/list/?${params.toString()}`, {
		headers: {
			Authorization: `Token ${process.env.READWISE_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});
	if (!response.ok) {
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
			console.warn(`Rate limit hit, waiting ${retryAfter} seconds before retrying...`);
			await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
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
): ReadwiseDocumentInsert => {
	let validSourceUrl: string | null = null;
	if (article.source_url) {
		try {
			if (/^https?:\/\//.test(article.source_url)) {
				new URL(article.source_url);
				validSourceUrl = article.source_url;
			}
		} catch {
			console.log(`Skipping invalid source_url: ${article.source_url}`);
		}
	}

	let validImageUrl: string | null = null;
	if (article.image_url) {
		try {
			if (/^https?:\/\//.test(article.image_url)) {
				new URL(article.image_url);
				validImageUrl = article.image_url;
			}
		} catch {
			console.log(`Skipping invalid image_url: ${article.image_url}`);
		}
	}

	return {
		id: article.id,
		parentId: article.parent_id,
		url: article.url,
		title: article.title || null,
		author: article.author || null,
		source: article.source,
		category: article.category,
		location: article.location,
		tags: article.tags,
		siteName: article.site_name || null,
		wordCount: article.word_count,
		summary: article.summary || null,
		content: article.content || null,
		htmlContent: article.html_content || null,
		notes: article.notes || null,
		imageUrl: validImageUrl,
		sourceUrl: validSourceUrl,
		readingProgress: article.reading_progress.toString(),
		firstOpenedAt: article.first_opened_at,
		lastOpenedAt: article.last_opened_at,
		savedAt: article.saved_at,
		lastMovedAt: article.last_moved_at,
		publishedDate: article.published_date
			? article.published_date.toISOString().split('T')[0]
			: null,
		contentCreatedAt: article.created_at,
		contentUpdatedAt: article.updated_at,
		integrationRunId,
	};
};

function sortDocumentsByHierarchy(documents: ReadwiseArticle[]): ReadwiseArticle[] {
	// Create a map of id to document for quick lookup
	const idToDocument = new Map(documents.map((doc) => [doc.id, doc]));
	function getAncestryChain(doc: ReadwiseArticle): string[] {
		const chain: string[] = [];
		let current = doc;
		while (current.parent_id) {
			const parent = idToDocument.get(current.parent_id);
			if (!parent) break;
			chain.push(current.parent_id);
			current = parent;
		}
		return chain;
	}
	return [...documents].sort((a, b) => {
		const aChain = getAncestryChain(a);
		const bChain = getAncestryChain(b);
		if (aChain.length !== bChain.length) {
			return aChain.length - bChain.length;
		}
		return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
	});
}

async function syncReadwiseDocuments(integrationRunId: number): Promise<number> {
	const lastUpdateTime = await getMostRecentUpdateTime();
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

	// First, process any new or updated documents.
	let successCount = 0;
	if (allDocuments.length > 0) {
		console.log(`Retrieved ${allDocuments.length} documents to process`);
		const sortedDocuments = sortDocumentsByHierarchy(allDocuments);
		for (const doc of sortedDocuments) {
			try {
				const mappedDoc = mapReadwiseArticleToDocument(doc, integrationRunId);
				await db
					.insert(readwiseDocuments)
					.values(mappedDoc)
					.onConflictDoUpdate({
						target: readwiseDocuments.id,
						set: {
							...mappedDoc,
							recordUpdatedAt: new Date(),
						},
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
	}

	// Automatically create index entries for authors, tags, and documents.
	console.log('Processing readwise authors');
	await createReadwiseAuthors();
	console.log('Creating index entries for readwise authors');
	await createEntitiesFromReadwiseAuthors();
	console.log('Processing readwise tags');
	await createReadwiseTags(integrationRunId);
	console.log('Creating categories from readwise tags');
	await createCategoriesFromReadwiseTags();
	console.log('Creating records and linking relationships from readwise documents');
	await createRecordsFromReadwiseDocuments();
	console.log('Creating media from readwise documents');
	await createMediaFromReadwiseDocuments();
	return successCount;
}

const main = async () => {
	try {
		await runIntegration('readwise', syncReadwiseDocuments);
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
