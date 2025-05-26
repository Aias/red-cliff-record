import { eq } from 'drizzle-orm';
import { createEmbedding } from '../../app/lib/server/create-embedding';
import type { FullRecord } from '../api/routers/types';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';
import { db } from '@/db/connections';
import { records, RunType } from '@/db/schema';
import { createRecordEmbeddingText, getRecordTitle } from '@/shared/lib/embedding';

const logger = createIntegrationLogger('services', 'embed-records');

/**
 * Maximum number of records retrieved in a single run.
 */
const RECORD_LIMIT = 5000;

/**
 * Number of records processed concurrently in each batch.
 */
const BATCH_SIZE = 25;

export async function embedRecords(): Promise<number> {
	logger.start('Embedding records');

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
		limit: RECORD_LIMIT,
	});

	logger.info(`Found ${curatedRecords.length} records without embeddings`);

	let processedCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for (let i = 0; i < curatedRecords.length; i += BATCH_SIZE) {
		const batch = curatedRecords.slice(i, i + BATCH_SIZE);

		const batchResults = await Promise.all(
			batch.map(async (record) => {
				const textToEmbed = createRecordEmbeddingText(record);

				if (!textToEmbed) {
					logger.warn(`No text to embed for record ${record.id}, skipping`);
					return { status: 'skipped' };
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
					return { status: 'processed' };
				} catch (error) {
					logger.error(`Error processing record ${record.id}: ${error}`);
					return { status: 'error' };
				}
			})
		);

		for (const result of batchResults) {
			switch (result.status) {
				case 'processed':
					processedCount++;
					break;
				case 'error':
					errorCount++;
					break;
				case 'skipped':
					skippedCount++;
					break;
			}
		}
	}

	logger.complete(
		`Processed ${processedCount} records successfully, ${errorCount} errors, ${skippedCount} skipped`
	);

	return processedCount;
}

export async function runEmbedRecordsIntegration() {
	await runIntegration('embeddings', embedRecords, RunType.enum.sync);
}

const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING EMBEDDING FOR RECORDS ===\n');
		await runEmbedRecordsIntegration();
		console.log('\n=== EMBEDDING FOR RECORDS COMPLETED ===\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in embedding records:', error);
		console.log('\n=== EMBEDDING FOR RECORDS FAILED ===\n');
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embed-records.ts')) {
	main();
}
