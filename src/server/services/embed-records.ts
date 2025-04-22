import { eq } from 'drizzle-orm';
import { createEmbedding } from '../../app/lib/server/create-embedding';
import type { FullRecord } from '../api/routers/records.types';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';
import { db } from '@/db/connections';
import { records, RunType } from '@/db/schema';
import { createRecordEmbeddingText, getRecordTitle } from '@/lib/embedding';

const logger = createIntegrationLogger('services', 'embed-records');
const BATCH_SIZE = 5000;

export async function embedCuratedRecords(): Promise<number> {
	logger.start('Embedding curated records');

	const curatedRecords: FullRecord[] = await db.query.records.findMany({
		with: {
			outgoingLinks: {
				with: {
					target: {
						columns: {
							textEmbedding: false,
						},
					},
					predicate: true,
				},
			},
			incomingLinks: {
				with: {
					source: {
						columns: {
							textEmbedding: false,
						},
					},
					predicate: true,
				},
				where: {
					predicate: {
						slug: {
							notIn: ['format_of'], // Would bring back too many that are not useful for embedding.
						},
					},
				},
			},
			media: true,
		},
		where: {
			textEmbedding: {
				isNull: true,
			},
		},
		orderBy: {
			recordUpdatedAt: 'desc',
		},
		limit: BATCH_SIZE,
	});

	logger.info(`Found ${curatedRecords.length} curated records to embed`);

	let processedCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for (const record of curatedRecords) {
		const textToEmbed = createRecordEmbeddingText(record);

		if (!textToEmbed) {
			logger.warn(`No text to embed for record ${record.id}, skipping`);
			skippedCount++;
			continue;
		}

		logger.info(`Embedding record ${record.id}: ${getRecordTitle(record, 100)}`);
		try {
			const embedding = await createEmbedding(textToEmbed);
			await db
				.update(records)
				.set({
					textEmbedding: embedding,
				})
				.where(eq(records.id, record.id));
			logger.info(`Successfully embedded record ${record.id}`);
			processedCount++;
		} catch (error) {
			logger.error(`Error processing record ${record.id}: ${error}`);
			errorCount++;
		}
	}

	logger.complete(
		`Processed ${processedCount} records successfully, ${errorCount} errors, ${skippedCount} skipped`
	);
	return processedCount;
}

export async function runEmbedCuratedRecordsIntegration() {
	await runIntegration('embeddings', embedCuratedRecords, RunType.enum.sync);
}

const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING EMBEDDING FOR CURATED RECORDS ===\n');
		await runEmbedCuratedRecordsIntegration();
		console.log('\n=== EMBEDDING FOR CURATED RECORDS COMPLETED ===\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in embedding curated records:', error);
		console.log('\n=== EMBEDDING FOR CURATED RECORDS FAILED ===\n');
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embed-records.ts')) {
	main();
}
