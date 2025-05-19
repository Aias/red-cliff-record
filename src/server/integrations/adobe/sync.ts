import { db } from '@/server/db/connections';
import { lightroomImages } from '@/server/db/schema/adobe';
import { env } from '../common/env';
import { fetchWithRetry } from '../common/fetch-with-retry';
import { runIntegration } from '../common/run-integration';
import { createMediaFromLightroomImages } from './map';
import { LightroomJsonResponseSchema, type LightroomJsonResponse } from './types';

/**
 * Configuration constants
 */
const ALBUM_URL =
	'https://lightroom.adobe.com/v2/spaces/f89a3c5060d8467a952c66de97edbe39/albums/f1edd4179e2f4e1d802f8a94f40b542c/assets?embed=asset%3Buser&order_after=-&exclude=incomplete&subtype=image';

/**
 * Synchronizes Lightroom images with the database
 *
 * This function:
 * 1. Fetches image data from the Adobe Lightroom API
 * 2. Processes and validates the response
 * 3. Stores each image in the database
 * 4. Creates media records from the Lightroom images
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of successfully processed images
 * @throws Error if the API request fails or processing encounters an error
 */
async function syncLightroomImages(integrationRunId: number): Promise<number> {
	try {
		console.log('Fetching Lightroom album data...');

		// Step 1: Fetch data from the Lightroom API
		const response = await fetchWithRetry(ALBUM_URL, {
			headers: {
				Authorization: `Bearer ${env.ADOBE_API_TOKEN}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Lightroom API request failed with status ${response.status}`);
		}

		// Step 2: Process and validate the response
		const textData = await response.text();
		// Adobe API sometimes returns JSONP with a while(1){} prefix that needs to be removed
		const jsonData = LightroomJsonResponseSchema.parse(
			JSON.parse(textData.replace(/^while\s*\(1\)\s*{\s*}\s*/, ''))
		);

		console.log(`Retrieved ${jsonData.resources.length} resources from Lightroom`);

		// Step 3: Process and store each image
		const baseUrl = jsonData.base;
		let successCount = 0;

		for (const resource of jsonData.resources) {
			try {
				await processLightroomImage(resource, baseUrl, integrationRunId);
				successCount++;
			} catch (error) {
				console.error('Error processing image:', {
					imageId: resource.asset.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		console.log(
			`Successfully processed ${successCount} out of ${jsonData.resources.length} images`
		);

		// Step 4: Create media records from the Lightroom images
		await createMediaFromLightroomImages();

		return successCount;
	} catch (error) {
		console.error('Error syncing Lightroom images:', error);
		throw new Error(
			`Failed to sync Lightroom images: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Processes a single Lightroom image and stores it in the database
 *
 * @param resource - The Lightroom resource containing image data
 * @param baseUrl - The base URL for image renditions
 * @param integrationRunId - The ID of the current integration run
 * @returns Promise that resolves when the image is processed
 */
async function processLightroomImage(
	resource: LightroomJsonResponse['resources'][number],
	baseUrl: string,
	integrationRunId: number
): Promise<void> {
	const asset = resource.asset;
	const { payload, created, updated, links, id } = asset;
	const {
		importSource,
		autoTags,
		develop,
		changedOnDevice,
		xmp,
		location,
		ratings,
		aesthetics,
		captureDate,
		userUpdated,
	} = payload;

	// Construct the URL for the 2048px rendition
	const url2048 = `${baseUrl}${links['/rels/rendition_type/2048'].href}`;

	// Extract rating information if available
	const firstRatingKey = ratings ? Object.keys(ratings)[0] : undefined;
	const rating = firstRatingKey && ratings ? (ratings[firstRatingKey]?.rating ?? 0) : 0;

	// Prepare the image data for database insertion
	const imageToInsert = {
		id: id,
		url2048,
		baseUrl,
		links: links,
		fileName: importSource.fileName,
		contentType: importSource.contentType,
		sourceDevice: changedOnDevice ?? importSource.importedOnDevice ?? develop.device,
		cameraMake: xmp.tiff.Make,
		cameraModel: xmp.tiff.Model,
		cameraLens: xmp.aux?.Lens,
		captureDate: captureDate,
		userUpdatedDate: userUpdated,
		fileSize: importSource.fileSize,
		croppedWidth: develop.croppedWidth,
		croppedHeight: develop.croppedHeight,
		aesthetics: aesthetics,
		exif: xmp.exif,
		location: location,
		rating: rating,
		autoTags: Object.keys(autoTags.tags),
		contentCreatedAt: created,
		contentUpdatedAt: updated,
		integrationRunId: integrationRunId,
	};

	// Insert or update the image in the database
	await db
		.insert(lightroomImages)
		.values(imageToInsert)
		.onConflictDoUpdate({
			target: lightroomImages.id,
			set: { ...imageToInsert, recordUpdatedAt: new Date() },
		});
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING ADOBE LIGHTROOM SYNC ===\n');
		await runIntegration('lightroom', syncLightroomImages);
		console.log('\n=== ADOBE LIGHTROOM SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Lightroom sync main function:', error);
		console.log('\n=== ADOBE LIGHTROOM SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncLightroomImages };
