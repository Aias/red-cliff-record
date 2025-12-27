import { records, RunType } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { uploadMediaToR2 } from '@/server/lib/media';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';

const logger = createIntegrationLogger('services', 'save-avatars');

/**
 * Maximum number of retries for transient errors
 */
const MAX_RETRIES = 2;

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
	const assetsDomain = Bun.env.ASSETS_DOMAIN!;

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

	let processedCount = 0;
	let errorCount = 0;
	let skippedCount = 0;

	for (const record of recordsWithAvatars) {
		if (!record.avatarUrl) {
			skippedCount++;
			continue; // Typescript safety check
		}

		let retries = 0;
		let success = false;

		while (!success && retries <= MAX_RETRIES) {
			try {
				if (retries > 0) {
					logger.info(`Retry ${retries}/${MAX_RETRIES} for record ${record.id}`);
				}

				logger.info(
					`Processing avatar for record ${record.id} (${record.title || 'Untitled'}): ${record.avatarUrl}`
				);

				// Upload to R2 (function will skip if already on R2)
				const newUrl = await uploadMediaToR2(record.avatarUrl);

				// Skip update if URL didn't change (already in R2)
				if (newUrl === record.avatarUrl) {
					logger.info(`Avatar for record ${record.id} is already on R2, skipping`);
					skippedCount++;
					success = true;
					break;
				}

				// Update the record with the new URL
				await db
					.update(records)
					.set({
						avatarUrl: newUrl,
						recordUpdatedAt: new Date(),
					})
					.where(eq(records.id, record.id));

				logger.info(
					`Updated avatar URL for record ${record.id} from ${record.avatarUrl} to ${newUrl}`
				);
				processedCount++;
				success = true;
			} catch (error) {
				retries++;

				// Categorize errors to provide more detailed logging
				if (error instanceof TypeError || error instanceof URIError) {
					// Invalid URL or malformed input errors - don't retry these
					logger.error(`Invalid URL for record ${record.id}: ${record.avatarUrl}`, error);
					errorCount++;
					await db
						.update(records)
						.set({
							avatarUrl: null,
							recordUpdatedAt: new Date(),
							isCurated: false,
						})
						.where(eq(records.id, record.id));
					break;
				} else if (error instanceof Error && error.message.includes('Failed to download')) {
					// Remote resource errors - might be temporary
					logger.error(`Failed to download avatar for record ${record.id}`, error);
					if (retries > MAX_RETRIES) {
						errorCount++;
						await db
							.update(records)
							.set({
								avatarUrl: null,
								recordUpdatedAt: new Date(),
								isCurated: false,
							})
							.where(eq(records.id, record.id));
					}
				} else {
					// Other errors (e.g., storage/database errors)
					logger.error(`Failed to process avatar for record ${record.id}`, error);
					if (retries > MAX_RETRIES) {
						errorCount++;
						await db
							.update(records)
							.set({
								avatarUrl: null,
								recordUpdatedAt: new Date(),
								isCurated: false,
							})
							.where(eq(records.id, record.id));
					}
				}
			}
		}
	}

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
		console.log('\n=== STARTING AVATAR TRANSFER ===\n');
		await runSaveAvatarsIntegration();
		console.log('\n=== AVATAR TRANSFER COMPLETED ===\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in avatar transfer:', error);
		console.log('\n=== AVATAR TRANSFER FAILED ===\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.main) {
	void main();
}
