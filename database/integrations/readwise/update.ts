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
	sourceUrl: article.source_url,
	title: cleanString(article.title),
	author: cleanString(article.author),
	source: article.source,
	category: article.category,
	location: article.location,
	tags: Object.keys(article.tags || {}),
	siteName: article.site_name,
	wordCount: article.word_count,
	notes: cleanString(article.notes),
	publishedDate: article.published_date
		? new Date(article.published_date).toISOString().split('T')[0]
		: null,
	summary: cleanString(article.summary),
	imageUrl: article.image_url,
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

async function processReadwiseDocuments(integrationRunId: number): Promise<number> {
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

	// Sort documents so parents come before children
	allDocuments.sort((a, b) => {
		if (!a.parent_id && b.parent_id) return -1;
		if (a.parent_id && !b.parent_id) return 1;
		return 0;
	});

	let successCount = 0;

	for (const doc of allDocuments) {
		try {
			const mappedDoc = mapReadwiseArticleToDocument(doc, integrationRunId);

			await db.insert(documents).values(mappedDoc).onConflictDoUpdate({
				target: documents.id,
				set: mappedDoc
			});

			successCount++;
		} catch (error) {
			console.error('Error processing document:', {
				id: doc.id,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	console.log(`Successfully processed ${successCount} out of ${allDocuments.length} documents`);
	return successCount;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.READWISE, processReadwiseDocuments, RunType.INCREMENTAL);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./update.ts')) {
	main();
}

export { main as seedReadwiseDocuments };
