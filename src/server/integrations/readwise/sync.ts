import { db } from '@/server/db/connections';
import { readwiseDocuments, type ReadwiseDocumentInsert } from '@/server/db/schema/readwise';
import { createDebugContext } from '../common/debug-output';
import { requireEnv } from '../common/env';
import { createIntegrationLogger } from '../common/logging';
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
const RETRY_DELAY_BASE = 1000; // 1 second in milliseconds
const READWISE_TOKEN = requireEnv('READWISE_TOKEN');
const logger = createIntegrationLogger('readwise', 'sync');

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
		logger.info(
			`Last known readwise date: ${mostRecent.contentUpdatedAt?.toLocaleString() ?? 'none'}`
		);
		return mostRecent.contentUpdatedAt;
	}
	logger.info('No existing documents found');
	return null;
}

/**
 * Fetches documents from the Readwise API
 *
 * This function handles pagination and rate limiting automatically.
 *
 * @param pageCursor - Optional cursor for pagination
 * @param updatedAfter - Optional date to filter documents updated after this time
 * @param collectRawData - Optional array to collect raw API responses before validation
 * @returns Promise resolving to the API response with documents
 * @throws Error if the API request fails
 */
async function fetchReadwiseDocuments(
	pageCursor?: string,
	updatedAfter?: Date,
	collectRawData?: unknown[]
): Promise<ReadwiseArticlesResponse> {
	const params = new URLSearchParams();
	let updatedAfterParam: string | null = null;

	if (pageCursor) params.append('pageCursor', pageCursor);
	if (updatedAfter) {
		const afterDate = new Date(updatedAfter.getTime() + 1);
		updatedAfterParam = afterDate.toISOString();
		params.append('updatedAfter', updatedAfterParam);
	}
	params.append('withHtmlContent', 'true');

	let attempt = 0;
	while (true) {
		logger.info(`Fetching Readwise documents${pageCursor ? ' (with cursor)' : ''}`);
		const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
			headers: {
				Authorization: `Token ${READWISE_TOKEN}`,
				'Content-Type': 'application/json',
			},
		});

		if (response.ok) {
			const data = await response.json();
			// Collect raw data BEFORE validation
			if (collectRawData) {
				collectRawData.push({
					request: {
						pageCursor: pageCursor ?? null,
						updatedAfter: updatedAfterParam,
						query: params.toString(),
					},
					response: data,
				});
			}
			const parsed = ReadwiseArticlesResponseSchema.parse(data);
			return parsed;
		}

		if (response.status === 429) {
			const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
			logger.warn(`Rate limit hit, waiting ${retryAfter} seconds before retrying...`);
			await new Promise((r) => setTimeout(r, retryAfter * RETRY_DELAY_BASE));
			continue;
		}

		attempt++;
		if (attempt >= 3) {
			throw new Error(
				`Failed to fetch Readwise documents: ${response.statusText} (${response.status})`
			);
		}
		logger.warn(`Request failed with status ${response.status}, retrying...`);
		await new Promise((r) => setTimeout(r, RETRY_DELAY_BASE));
	}
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
			logger.warn(`Skipping invalid source_url: ${article.source_url}`);
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
			logger.warn(`Skipping invalid image_url: ${article.image_url}`);
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
 * @param debug - If true, writes raw API data to a timestamped JSON file
 * @returns The number of successfully processed documents
 * @throws Error if API requests fail
 */
async function syncReadwiseDocuments(integrationRunId: number, debug = false): Promise<number> {
	const debugContext = createDebugContext('readwise', debug, [] as unknown[]);
	try {
		logger.start('Starting Readwise documents sync');

		// Step 1: Determine last sync point
		const lastUpdateTime = await getMostRecentUpdateTime();

		// Step 2: Fetch all documents
		logger.info('Fetching documents from Readwise API');
		const allDocuments: ReadwiseArticle[] = [];
		const rawDebugData = debugContext.data;
		let nextPageCursor: string | null = null;

		do {
			const response = await fetchReadwiseDocuments(
				nextPageCursor ?? undefined,
				lastUpdateTime ?? undefined,
				rawDebugData
			);
			allDocuments.push(...response.results);
			nextPageCursor = response.nextPageCursor;

			logger.info(`Retrieved ${response.results.length} documents (total: ${allDocuments.length})`);
		} while (nextPageCursor);

		// Step 3: Process documents
		let successCount = 0;
		if (allDocuments.length > 0) {
			logger.info(`Processing ${allDocuments.length} documents`);

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
						logger.info(`Processed ${successCount} of ${sortedDocuments.length} documents`);
					}
				} catch (error) {
					logger.error('Error processing document', {
						documentId: doc.id,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Step 4: Create related entities
			logger.info('Creating related entities');
			await createReadwiseAuthors();
			await createReadwiseTags(integrationRunId);
			await createRecordsFromReadwiseAuthors();
			await createRecordsFromReadwiseTags();
			await createRecordsFromReadwiseDocuments();
		}

		logger.complete('Processed documents', successCount);
		return successCount;
	} catch (error) {
		logger.error('Error syncing Readwise documents', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output for Readwise', flushError);
		});
	}
}

/**
 * Wrapper function that uses runIntegration
 */
async function syncReadwiseData(debug = false): Promise<void> {
	await runIntegration('readwise', (runId) => syncReadwiseDocuments(runId, debug));
}

export { syncReadwiseData as syncReadwiseDocuments };
