import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import type { FullRecord } from '../api/routers/records.types';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';
import { createEmbedding } from './ai/create-embedding';
import { db } from '@/db/connections';
import { records, RunType } from '@/db/schema';

const logger = createIntegrationLogger('services', 'embed-records');
const OUTPUT_FILE = '.temp/record-embeddings.md';
const OUTPUT_TO_FILE = false;
const BATCH_SIZE = 5000;

const truncateText = (text: string, maxLength: number = 200) => {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength) + '...';
};

const trimBreaks = (text: string) => {
	return text.replace(/\n/g, ' ').trim();
};

const getRecordTitle = (record: Partial<FullRecord>, maxLength: number = 200) => {
	const { title, abbreviation, sense, content, summary } = record;

	if (title) {
		const titleParts = [title];
		if (abbreviation) {
			titleParts.push(`(${abbreviation})`);
		}
		if (sense) {
			titleParts.push(`*${sense}*`);
		}
		return titleParts.join(' ');
	}

	if (summary) {
		return truncateText(trimBreaks(summary), maxLength);
	}

	if (content) {
		return truncateText(trimBreaks(content), maxLength);
	}

	return 'Untitled Record';
};

const createRecordEmbeddingText = (record: FullRecord) => {
	const {
		title,
		content,
		summary,
		notes,
		mediaCaption,
		creators,
		created,
		format,
		parent,
		children,
		media,
		references,
		referencedBy,
		url,
	} = record;

	const textParts = [];

	if (title) {
		textParts.push(`# ${getRecordTitle(record)}`);
	}

	const metaParts = [];
	if (creators.length > 0) {
		metaParts.push(`Created By: ${creators.map((c) => getRecordTitle(c)).join(', ')}`);
	}
	if (created.length > 0) {
		metaParts.push(`Creator Of:\n - ${created.map((c) => getRecordTitle(c)).join('\n - ')}`);
	}
	if (format) {
		metaParts.push(`Format: ${getRecordTitle(format)}`);
	}
	if (url) {
		metaParts.push(`URL: ${url}`);
	}
	if (metaParts.length > 0) {
		textParts.push(metaParts.join('\n'));
	}

	const contentParts = [];
	if (parent) {
		contentParts.push(`From: ${getRecordTitle(parent)}`);
	}
	if (summary) {
		contentParts.push(`**${summary}**`);
	}
	if (content) {
		contentParts.push(`${content}`);
	}
	if (mediaCaption && media.length > 0) {
		contentParts.push(`${mediaCaption}`);
	}
	if (children.length > 0) {
		contentParts.push(
			`Children:\n - ${children.map((c) => getRecordTitle(c, 1000)).join('\n - ')}`
		);
	}
	if (references.length > 0) {
		contentParts.push(`References:\n - ${references.map((r) => getRecordTitle(r)).join('\n - ')}`);
	}
	if (referencedBy.length > 0) {
		contentParts.push(
			`Referenced By:\n - ${referencedBy.map((r) => getRecordTitle(r)).join('\n - ')}`
		);
	}
	if (notes) {
		contentParts.push(`[Note:] ${notes}`);
	}
	if (contentParts.length > 0) {
		textParts.push(contentParts.join('\n\n'));
	}

	return textParts.join('\n\n');
};

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
			isCurated: true,
			textEmbedding: {
				isNull: true,
			},
			OR: [
				{ parentId: { isNull: true } },
				{ references: { id: { isNotNull: true } } },
				{ referencedBy: { id: { isNotNull: true } } },
			],
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
