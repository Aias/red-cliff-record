import { records, RunType } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { uploadMediaToR2 } from '@/server/lib/media';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { EnvSchema } from '@/shared/lib/env';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';

const logger = createIntegrationLogger('services', 'save-avatars');

/**
 * Transfers avatar images from records to permanent R2 storage
 *
 * Looks for records with:
 * 1. Non-null avatarUrl
 * 2. isCurated set to true
 *
 * Then:
 * 1. Uploads the avatar image to R2
 * 2. Updates the record with the new R2 URL
 *
 * @param integrationRunId - Optional ID for tracking the integration run
 * @returns Promise that resolves to the number of avatars processed
 */
export async function saveAvatarsToR2(): Promise<number> {
	logger.start('Saving record avatars to R2 storage');
	const { ASSETS_DOMAIN: assetsDomain } = EnvSchema.pick({ ASSETS_DOMAIN: true }).parse(
		process.env
	);

	// Find records with non-null avatarUrl and isCurated set to true
	const recordsWithAvatars = await db.query.records.findMany({
		columns: {
			id: true,
			avatarUrl: true,
			title: true,
		},
		where: {
			avatarUrl: {
				isNotNull: true,
				notIlike: `%${assetsDomain}%`,
			},
			isCurated: true,
		},
	});

	logger.info(`Found ${recordsWithAvatars.length} records with avatars to transfer`);

	type AvatarResult = { status: 'processed' } | { status: 'skipped' } | { status: 'error' };
	const retryDelays = [2000, 5000]; // Backoff: 2s, then 5s

	const results = await runConcurrentPool({
		items: recordsWithAvatars,
		concurrency: 10,
		worker: async (record): Promise<AvatarResult> => {
			if (!record.avatarUrl) {
				return { status: 'skipped' };
			}

			const maxRetries = retryDelays.length;
			let attempt = 0;

			while (attempt <= maxRetries) {
				try {
					if (attempt > 0) {
						const delay = retryDelays[attempt - 1];
						if (delay === undefined) {
							throw new Error(`Missing retry delay for attempt ${attempt}`);
						}
						logger.info(`Retry ${attempt}/${maxRetries} for record ${record.id} after ${delay}ms`);
						await new Promise((resolve) => setTimeout(resolve, delay));
					}

					logger.info(
						`Processing avatar for record ${record.id} (${record.title || 'Untitled'}): ${record.avatarUrl}`
					);

					const newUrl = await uploadMediaToR2(record.avatarUrl);

					if (newUrl === record.avatarUrl) {
						logger.info(`Avatar for record ${record.id} is already on R2, skipping`);
						return { status: 'skipped' };
					}

					await db
						.update(records)
						.set({ avatarUrl: newUrl, recordUpdatedAt: new Date() })
						.where(eq(records.id, record.id));

					logger.info(`Updated avatar URL for record ${record.id}`);
					return { status: 'processed' };
				} catch (error) {
					// Non-retryable errors: invalid URL or malformed input
					if (error instanceof TypeError || error instanceof URIError) {
						logger.error(`Invalid URL for record ${record.id}: ${record.avatarUrl}`, error);
						await db
							.update(records)
							.set({ avatarUrl: null, recordUpdatedAt: new Date(), isCurated: false })
							.where(eq(records.id, record.id));
						return { status: 'error' };
					}

					attempt++;

					// Log the error
					if (error instanceof Error && error.message.includes('Failed to download')) {
						logger.error(`Failed to download avatar for record ${record.id}`, error);
					} else {
						logger.error(`Failed to process avatar for record ${record.id}`, error);
					}

					// If we've exhausted retries, mark as failed
					if (attempt > maxRetries) {
						await db
							.update(records)
							.set({ avatarUrl: null, recordUpdatedAt: new Date(), isCurated: false })
							.where(eq(records.id, record.id));
						return { status: 'error' };
					}
				}
			}

			return { status: 'error' }; // Should never reach here
		},
		onProgress: (completed, total) => {
			if (completed % 10 === 0 || completed === total) {
				logger.info(`Progress: ${completed}/${total}`);
			}
		},
	});

	const processedCount = results.filter((r) => r.ok && r.value.status === 'processed').length;
	const skippedCount = results.filter((r) => r.ok && r.value.status === 'skipped').length;
	const errorCount = results.filter((r) => !r.ok || r.value.status === 'error').length;

	logger.complete(
		`Processed ${processedCount} avatars (${skippedCount} skipped, ${errorCount} errors)`
	);
	return processedCount;
}

/**
 * Run the avatar saving process as a tracked integration
 */
export async function runSaveAvatarsIntegration(): Promise<void> {
	await runIntegration('manual', saveAvatarsToR2, RunType.enum.sync);
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		logger.start('Starting avatar transfer');
		await runSaveAvatarsIntegration();
		logger.complete('Avatar transfer completed');
		process.exit(0);
	} catch (error) {
		logger.error('Error in avatar transfer', error);
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.main) {
	void main();
}
