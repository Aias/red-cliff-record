import { records, RunType } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { createEmbedding } from '../../app/lib/server/create-embedding';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createRecordEmbeddingText, getRecordTitle } from '@/shared/lib/embedding';
import type { FullRecord } from '@/shared/types';

const logger = createIntegrationLogger('services', 'embed-records');

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
		limit: 5000,
	});

	logger.info(`Found ${curatedRecords.length} records without embeddings`);

	type EmbedResult = { status: 'processed' } | { status: 'skipped' } | { status: 'error' };

	const results = await runConcurrentPool({
		items: curatedRecords,
		concurrency: 25,
		worker: async (record): Promise<EmbedResult> => {
			const textToEmbed = createRecordEmbeddingText(record);

			if (!textToEmbed) {
				logger.warn(`No text to embed for record ${record.id}, skipping`);
				return { status: 'skipped' };
			}

			logger.info(`Embedding record ${record.id}: ${getRecordTitle(record, 100)}`);

			try {
				const embedding = await createEmbedding(textToEmbed);
				await db.update(records).set({ textEmbedding: embedding }).where(eq(records.id, record.id));

				logger.info(`Successfully embedded record ${record.id}`);
				return { status: 'processed' };
			} catch (error) {
				logger.error(`Error processing record ${record.id}: ${error}`);
				return { status: 'error' };
			}
		},
		onProgress: (completed, total) => {
			if (completed % 50 === 0 || completed === total) {
				logger.info(`Progress: ${completed}/${total}`);
			}
		},
	});

	const processedCount = results.filter((r) => r.ok && r.value.status === 'processed').length;
	const skippedCount = results.filter((r) => r.ok && r.value.status === 'skipped').length;
	const errorCount = results.filter((r) => !r.ok || r.value.status === 'error').length;

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
		logger.start('Starting embedding for records');
		await runEmbedRecordsIntegration();
		logger.complete('Embedding for records completed');
		process.exit(0);
	} catch (error) {
		logger.error('Error in embedding records', error);
		process.exit(1);
	}
};

if (import.meta.main) {
	void main();
}
