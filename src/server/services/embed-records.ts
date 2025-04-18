import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import { createEmbedding } from '../../app/lib/server/create-embedding';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';
import { db } from '@/db/connections';
import { records, RunType } from '@/db/schema';
import { createRecordEmbeddingText, getRecordTitle } from '@/lib/embedding';

const logger = createIntegrationLogger('services', 'embed-records');
const OUTPUT_FILE = '.temp/record-embeddings.md';
const OUTPUT_TO_FILE = false;
const BATCH_SIZE = 5000;

export async function embedCuratedRecords(): Promise<number> {
	logger.start('Embedding curated records');

	if (OUTPUT_TO_FILE) {
		const outputDir = dirname(OUTPUT_FILE);
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
			logger.info(`Created directory ${outputDir}`);
		}

		await Bun.write(OUTPUT_FILE, '');
		logger.info(`Cleared output file ${OUTPUT_FILE}`);
	}

	const curatedRecords = await db.query.records.findMany({
		with: {
			creators: true,
			created: true,
			format: true,
			formatOf: {
				limit: 20,
				orderBy: {
					recordUpdatedAt: 'desc',
				},
			},
			parent: true,
			children: true,
			media: true,
			references: {
				limit: 20,
				orderBy: {
					recordUpdatedAt: 'desc',
				},
			},
			referencedBy: {
				limit: 20,
				orderBy: {
					recordUpdatedAt: 'desc',
				},
			},
			transcludes: true,
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
	const textsToAppend: string[] = [];

	for (const record of curatedRecords) {
		const textToEmbed = createRecordEmbeddingText(record);

		if (!textToEmbed) {
			logger.warn(`No text to embed for record ${record.id}, skipping`);
			skippedCount++;
			continue;
		}

		logger.info(`Embedding record ${record.id}: ${getRecordTitle(record, 100)}`);
		try {
			if (OUTPUT_TO_FILE) {
				textsToAppend.push(textToEmbed);
			} else {
				const embedding = await createEmbedding(textToEmbed);
				await db
					.update(records)
					.set({
						textEmbedding: embedding,
					})
					.where(eq(records.id, record.id));
			}
			logger.info(`Successfully embedded record ${record.id}`);
			processedCount++;
		} catch (error) {
			logger.error(`Error processing record ${record.id}: ${error}`);
			errorCount++;
		}
	}

	if (OUTPUT_TO_FILE && textsToAppend.length > 0) {
		let fileContent = '';
		for (let i = 0; i < textsToAppend.length; i++) {
			fileContent += textsToAppend[i];
			fileContent += '\n\n---\n\n';
		}

		try {
			await Bun.write(OUTPUT_FILE, fileContent);
			logger.info(`Wrote ${textsToAppend.length} records to ${OUTPUT_FILE}`);
		} catch (writeError) {
			logger.error(`Failed to write records to ${OUTPUT_FILE}: ${writeError}`);
			errorCount += textsToAppend.length;
			processedCount -= textsToAppend.length;
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
