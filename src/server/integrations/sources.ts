import { eq } from 'drizzle-orm';
import { db } from '../db/connections';
import { records, type IntegrationType } from '../db/schema';

/**
 * Configuration for batch processing
 */
const BATCH_SIZE = 200;

/**
 * Updates the 'sources' field for all records based on their relationships
 *
 * This function:
 * 1. Processes records in batches to avoid memory issues
 * 2. Examines each record's relationships with integration entities
 * 3. Updates the record's 'sources' array with the integration types
 *
 * @returns Promise that resolves when all records have been processed
 */
export const updateRecordsSources = async (): Promise<void> => {
	console.log('Starting records sources update process');

	let offset = 0;
	let totalProcessed = 0;
	let batchCount = 0;

	try {
		// Process records in batches
		while (true) {
			batchCount++;
			console.log(`Fetching batch ${batchCount} (offset: ${offset}, size: ${BATCH_SIZE})`);

			// Fetch a batch of records with all their integration relationships
			const recordList = await fetchRecordBatch(offset, BATCH_SIZE);

			// Exit loop when no more records
			if (recordList.length === 0) {
				console.log('No more records to process');
				break;
			}

			console.log(`Processing batch with ${recordList.length} records`);

			// Process each record in the batch
			for (const record of recordList) {
				await updateRecordSources(record);
				totalProcessed++;
			}

			// Move to next batch
			offset += BATCH_SIZE;
		}

		console.log(`Successfully updated sources for ${totalProcessed} records`);
	} catch (error) {
		console.error('Error updating record sources:', error);
		throw new Error(
			`Failed to update record sources: ${error instanceof Error ? error.message : String(error)}`
		);
	}
};

/**
 * Fetches a batch of records with their integration relationships
 *
 * @param offset - Starting position for the query
 * @param limit - Maximum number of records to fetch
 * @returns Array of records with their relationships
 */
async function fetchRecordBatch(offset: number, limit: number) {
	return db.query.records.findMany({
		limit,
		offset,
		with: {
			airtableCreators: { columns: { id: true } },
			airtableExtracts: { columns: { id: true } },
			airtableFormats: { columns: { id: true } },
			airtableSpaces: { columns: { id: true } },
			githubRepositories: { columns: { id: true } },
			githubUsers: { columns: { id: true } },
			lightroomImages: { columns: { id: true } },
			raindropBookmarks: { columns: { id: true } },
			raindropCollections: { columns: { id: true } },
			raindropTags: { columns: { id: true } },
			readwiseAuthors: { columns: { id: true } },
			readwiseDocuments: { columns: { id: true } },
			readwiseTags: { columns: { id: true } },
			twitterTweets: { columns: { id: true } },
			twitterUsers: { columns: { id: true } },
		},
	});
}

/**
 * Determines and updates the sources for a single record
 *
 * @param record - The record with its relationships
 */
async function updateRecordSources(record: Awaited<ReturnType<typeof fetchRecordBatch>>[0]) {
	const sources: IntegrationType[] = [];

	// Check for Airtable sources
	if (
		record.airtableExtracts.length > 0 ||
		record.airtableCreators.length > 0 ||
		record.airtableFormats.length > 0 ||
		record.airtableSpaces.length > 0
	) {
		sources.push('airtable');
	}

	// Check for GitHub sources
	if (record.githubRepositories.length > 0 || record.githubUsers.length > 0) {
		sources.push('github');
	}

	// Check for Raindrop sources
	if (
		record.raindropBookmarks.length > 0 ||
		record.raindropCollections.length > 0 ||
		record.raindropTags.length > 0
	) {
		sources.push('raindrop');
	}

	// Check for Readwise sources
	if (
		record.readwiseDocuments.length > 0 ||
		record.readwiseTags.length > 0 ||
		record.readwiseAuthors.length > 0
	) {
		sources.push('readwise');
	}

	// Check for Twitter sources
	if (record.twitterTweets.length > 0 || record.twitterUsers.length > 0) {
		sources.push('twitter');
	}

	// Check for Lightroom sources
	if (record.lightroomImages.length > 0) {
		sources.push('lightroom');
	}

	// Only update if there are sources to set
	if (sources.length > 0) {
		console.log(`Setting sources for record ${record.id}: ${sources.join(', ')}`);

		await db.update(records).set({ sources }).where(eq(records.id, record.id));
	}
}

// Execute the function if this file is run directly
if (import.meta.url === import.meta.resolve('./sources.ts')) {
	updateRecordsSources()
		.then(() => {
			console.log('Records sources update completed successfully');
			process.exit(0);
		})
		.catch((error) => {
			console.error('Records sources update failed:', error);
			process.exit(1);
		});
}
