import { lightroomImages } from '@hozo';
import { db } from '@/server/db/connections/postgres';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import { createMediaFromLightroomImages } from './map';
import { LightroomJsonResponseSchema, type LightroomJsonResponse } from './types';

const logger = createIntegrationLogger('adobe', 'sync');

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
 * @param collectDebugData - Optional array to collect raw API data for debugging
 * @returns The number of successfully processed images
 * @throws Error if the API request fails or processing encounters an error
 */
async function syncLightroomImages(
  integrationRunId: number,
  collectDebugData?: unknown[]
): Promise<number> {
  try {
    logger.start('Fetching Lightroom album data');

    // Step 1: Fetch data from the Lightroom API
    const response = await fetch(ALBUM_URL);

    if (!response.ok) {
      throw new Error(`Lightroom API request failed with status ${response.status}`);
    }

    // Step 2: Process and validate the response
    const textData = await response.text();
    // Adobe API sometimes returns JSONP with a while(1){} prefix that needs to be removed
    const jsonData = LightroomJsonResponseSchema.parse(
      JSON.parse(textData.replace(/^while\s*\(1\)\s*{\s*}\s*/, ''))
    );

    logger.info(`Retrieved ${jsonData.resources.length} resources from Lightroom`);

    // Collect debug data if requested
    collectDebugData?.push(jsonData);

    // Step 3: Process and store each image concurrently
    const baseUrl = jsonData.base;
    let successCount = 0;
    let errorCount = 0;

    await runConcurrentPool({
      items: jsonData.resources,
      concurrency: 10,
      worker: async (resource) => {
        try {
          await processLightroomImage(resource, baseUrl, integrationRunId);
          successCount++;
        } catch (error) {
          errorCount++;
          logger.error('Error processing image', {
            imageId: resource.asset.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      onProgress: (completed, total) => {
        if (completed % 50 === 0 || completed === total) {
          logger.info(`Progress: ${completed}/${total} images processed`);
        }
      },
    });

    logger.complete(`Processed images`, successCount);
    if (errorCount > 0) {
      logger.info(`Errors: ${errorCount} images failed`);
    }
    logger.info(`Total images in album: ${jsonData.resources.length}`);

    // Step 4: Create media records from the Lightroom images
    await createMediaFromLightroomImages();

    return successCount;
  } catch (error) {
    logger.error('Error syncing Lightroom images', error);
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
 * Orchestrates the Adobe Lightroom data synchronization process
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 */
async function syncAdobeData(debug = false): Promise<void> {
  const debugContext = createDebugContext('adobe', debug, [] as unknown[]);
  try {
    if (debug) {
      // Debug mode: fetch data and output to .temp/ only, skip database writes
      logger.start('Starting Adobe Lightroom data fetch (debug mode - no database writes)');
      const response = await fetch(ALBUM_URL);
      if (!response.ok) {
        throw new Error(`Lightroom API request failed with status ${response.status}`);
      }
      const textData = await response.text();
      const jsonData = LightroomJsonResponseSchema.parse(
        JSON.parse(textData.replace(/^while\s*\(1\)\s*{\s*}\s*/, ''))
      );
      debugContext.data?.push(jsonData);
      logger.complete(`Fetched ${jsonData.resources.length} images (debug mode)`);
    } else {
      // Normal mode: full sync with database writes
      logger.start('Starting Adobe Lightroom data synchronization');
      await runIntegration('lightroom', (runId) => syncLightroomImages(runId, debugContext.data));
      logger.complete('Adobe Lightroom data synchronization completed');
    }
  } catch (error) {
    logger.error('Error syncing Adobe Lightroom data', error);
    throw error;
  } finally {
    await debugContext.flush().catch((flushError) => {
      logger.error('Failed to write debug output for Adobe', flushError);
    });
  }
}

export { syncAdobeData as syncLightroomImages };
