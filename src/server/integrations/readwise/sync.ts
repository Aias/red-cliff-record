import { db } from '@/server/db/connections';
import { readwiseDocuments, type ReadwiseDocumentInsert } from '@/server/db/schema/readwise';
import { runIntegration } from '../common/run-integration';
import {
	createReadwiseAuthors,
	createReadwiseTags,
	createRecordsFromReadwiseAuthors,
	createRecordsFromReadwiseDocuments,
	createRecordsFromReadwiseTags,
} from './map';
import {
	ReadwiseArticlesResponseSchema,
	type ReadwiseArticle,
	type ReadwiseArticlesResponse,
} from './types';

/**
 * Configuration constants
 */
const API_BASE_URL = 'https://readwise.io/api/v3/list/';
const RETRY_DELAY_BASE = 1000; // 1 second in millisecondså

/**
 * Retrieves the most recent update time from the database
 *
 * This is used to determine the cutoff point for fetching new documents
 *
 * @returns The date of the most recently updated document, or null if none exists
 */
async function getMostRecentUpdateTime(): Promise<Date | null> {
	const mostRecent = await db.query.readwiseDocuments.findFirst({
		columns: {
			contentUpdatedAt: true,
		},
		orderBy: {
			contentUpdatedAt: 'desc',
		},
	});
	if (mostRecent) {
		console.log(
			`Last known readwise date: ${mostRecent.contentUpdatedAt?.toLocaleString() ?? 'none'}`
		);
		return mostRecent.contentUpdatedAt;
	}
	console.log('No existing documents found');
	return null;
}

/**
 * Fetches documents from the Readwise API
 *
 * This function handles pagination and rate limiting automatically.
 *
 * @param pageCursor - Optional cursor for pagination
 * @param updatedAfter - Optional date to filter documents updated after this time
 * @returns Promise resolving to the API response with documents
 * @throws Error if the API request fails
 */
async function fetchReadwiseDocuments(
	pageCursor?: string,
	updatedAfter?: Date
): Promise<ReadwiseArticlesResponse> {
	// Build query parameters
	const params = new URLSearchParams();
	if (pageCursor) {
		params.append('pageCursor', pageCursor);
	}
	if (updatedAfter) {
		// Add 1ms to avoid duplicates at the boundary
		const afterDate = new Date(updatedAfter.getTime() + 1);
		params.append('updatedAfter', afterDate.toISOString());
	}
	params.append('withHtmlContent', 'true');

	// Make the API request
	console.log(`Fetching Readwise documents${pageCursor ? ' (with cursor)' : ''}...`);
	const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
		headers: {
			Authorization: `Token ${process.env.READWISE_TOKEN}`,
			'Content-Type': 'application/json',
		},
	});

	// Handle rate limiting
	if (!response.ok) {
		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
			console.warn(`Rate limit hit, waiting ${retryAfter} seconds before retrying...`);
			await new Promise((resolve) => setTimeout(resolve, retryAfter * RETRY_DELAY_BASE));
			return fetchReadwiseDocuments(pageCursor, updatedAfter);
		}
		throw new Error(
			`Failed to fetch Readwise documents: ${response.statusText} (${response.status})`
		);
	}

	// Parse and validate the response
	const data = await response.json();

	return ReadwiseArticlesResponseSchema.parse(data);
}

/**
 * Maps a Readwise article to a document format for database insertion
 *
 * This function validates URLs and handles null values appropriately.
 *
 * @param article - The Readwise article to map
 * @param integrationRunId - The ID of the current integration run
 * @returns A document object ready for database insertion
 */
const mapReadwiseArticleToDocument = (
	article: ReadwiseArticle,
	integrationRunId: number
): ReadwiseDocumentInsert => {
	// Validate source URL
	let validSourceUrl: string | null = null;
	if (article.source_url) {
		try {
			if (/^https?:\/\//.test(article.source_url)) {
				new URL(article.source_url);
				validSourceUrl = article.source_url;
			}
		} catch {
			console.warn(`Skipping invalid source_url: ${article.source_url}`);
		}
	}

	// Validate image URL
	let validImageUrl: string | null = null;
	if (article.image_url) {
		try {
			if (/^https?:\/\//.test(article.image_url)) {
				new URL(article.image_url);
				validImageUrl = article.image_url;
			}
		} catch {
			console.warn(`Skipping invalid image_url: ${article.image_url}`);
		}
	}

	// Map to database format
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

/**
 * Sorts documents by their hierarchical relationship
 *
 * This ensures that parent documents are processed before their children.
 *
 * @param documents - The documents to sort
 * @returns Sorted array of documents
 */
function sortDocumentsByHierarchy(documents: ReadwiseArticle[]): ReadwiseArticle[] {
	// Create a map of id to document for quick lookup
	const idToDocument = new Map(documents.map((doc) => [doc.id, doc]));

	// Helper function to get the ancestry chain for a document
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

	// Sort by ancestry chain length (parents first), then by creation date
	return [...documents].sort((a, b) => {
		const aChain = getAncestryChain(a);
		const bChain = getAncestryChain(b);
		if (aChain.length !== bChain.length) {
			return aChain.length - bChain.length;
		}
		return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
	});
}

/**
 * Synchronizes Readwise documents with the database
 *
 * This function:
 * 1. Determines the last sync point
 * 2. Fetches new or updated documents from the API
 * 3. Processes and stores the documents
 * 4. Creates related entities (authors, tags, records)
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed documents
 * @throws Error if API requests fail
 */
async function syncReadwiseDocuments(integrationRunId: number): Promise<number> {
	try {
		console.log('Starting Readwise documents sync...');

		// Step 1: Determine last sync point
		const lastUpdateTime = await getMostRecentUpdateTime();

		// Step 2: Fetch all documents
		console.log('Fetching documents from Readwise API...');
		const allDocuments: ReadwiseArticle[] = [];
		let nextPageCursor: string | null = null;

		do {
			const response = await fetchReadwiseDocuments(
				nextPageCursor ?? undefined,
				lastUpdateTime ?? undefined
			);
			allDocuments.push(...response.results);
			nextPageCursor = response.nextPageCursor;

			console.log(`Retrieved ${response.results.length} documents (total: ${allDocuments.length})`);
		} while (nextPageCursor);

		// Step 3: Process documents
		let successCount = 0;
		if (allDocuments.length > 0) {
			console.log(`Processing ${allDocuments.length} documents...`);

			// Sort documents to ensure parents are processed before children
			const sortedDocuments = sortDocumentsByHierarchy(allDocuments);

			// Process each document
			for (const doc of sortedDocuments) {
				try {
					// Map and insert the document
					const documentToInsert = mapReadwiseArticleToDocument(doc, integrationRunId);
					await db
						.insert(readwiseDocuments)
						.values(documentToInsert)
						.onConflictDoUpdate({
							target: readwiseDocuments.id,
							set: { ...documentToInsert, recordUpdatedAt: new Date() },
						});

					successCount++;

					// Log progress periodically
					if (successCount % 20 === 0) {
						console.log(`Processed ${successCount} of ${sortedDocuments.length} documents`);
					}
				} catch (error) {
					console.error('Error processing document:', {
						documentId: doc.id,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Step 4: Create related entities
			console.log('Creating related entities...');
			await createReadwiseAuthors();
			await createReadwiseTags(integrationRunId);
			await createRecordsFromReadwiseAuthors();
			await createRecordsFromReadwiseTags();
			await createRecordsFromReadwiseDocuments();
		}

		console.log(`Successfully processed ${successCount} documents`);
		return successCount;
	} catch (error) {
		console.error('Error syncing Readwise documents:', error);
		throw error;
	}
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING READWISE SYNC ===\n');
		await runIntegration('readwise', syncReadwiseDocuments);
		console.log('\n=== READWISE SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Readwise sync main function:', error);
		console.log('\n=== READWISE SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncReadwiseDocuments };
