import { randomUUID } from 'crypto';
import { mkdirSync, unlinkSync } from 'fs';
import { S3Client } from 'bun';
import mime from 'mime-types';
import { getMimeTypeFromURL, getSmartMetadata } from '@/app/lib/server/content-helpers';
import type { MediaInsert } from '@/server/db/schema';

// Environment variable validation for S3/R2
const requiredEnvVars = [
	'S3_REGION',
	'S3_ACCESS_KEY_ID',
	'S3_SECRET_ACCESS_KEY',
	'S3_BUCKET',
	'S3_ENDPOINT',
	'ASSETS_DOMAIN',
];

// Check for missing environment variables
for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		console.warn(`Warning: ${envVar} environment variable is not set`);
	}
}

/**
 * S3 client for Cloudflare R2 (or any S3-compatible storage)
 */
const s3 = new S3Client({
	region: process.env.S3_REGION!,
	accessKeyId: process.env.S3_ACCESS_KEY_ID!,
	secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	bucket: process.env.S3_BUCKET!,
	endpoint: process.env.S3_ENDPOINT!,
});

/**
 * Temporary directory for media processing
 */
const TEMP_MEDIA_DIR = '.temp/media';

/**
 * Downloads a remote media file and uploads it to the S3/R2 bucket
 *
 * This function:
 * 1. Checks if the media is already on R2
 * 2. Downloads the remote file
 * 3. Determines the content type
 * 4. Saves to a temporary location
 * 5. Uploads to S3/R2
 * 6. Returns the public URL
 *
 * @param mediaUrl - The remote URL of the media to download
 * @returns A publicly accessible (non-expiring) S3/R2 URL
 * @throws Error if download or upload fails
 */
export async function uploadMediaToR2(mediaUrl: string): Promise<string> {
	// Skip if already on R2
	if (mediaUrl.includes(process.env.ASSETS_DOMAIN!)) {
		console.log(`Media URL already on R2: ${mediaUrl}`);
		return mediaUrl;
	}

	let tempFilePath: string | null = null;

	try {
		// 1. Fetch the remote file
		const resp = await fetch(mediaUrl);
		if (!resp.ok) {
			throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
		}

		// 2. Determine content type
		let contentType = resp.headers.get('content-type') || '';

		// If content type not provided, guess from URL using the centralized function
		if (!contentType) {
			contentType = getMimeTypeFromURL(mediaUrl);
		}

		// 3. Create temp directory if it doesn't exist
		mkdirSync(TEMP_MEDIA_DIR, { recursive: true });

		// 4. Download file content
		const arrayBuffer = await resp.arrayBuffer();

		// 5. Generate unique filename with appropriate extension
		const uniqueName = randomUUID();
		const ext = mime.extension(contentType) || 'bin';
		tempFilePath = `${TEMP_MEDIA_DIR}/${uniqueName}.${ext}`;
		const objectKey = `${uniqueName}.${ext}`;

		// 6. Write to temporary file
		await Bun.write(tempFilePath, new Uint8Array(arrayBuffer));

		// 7. Upload to S3/R2
		await s3.write(
			objectKey,
			new Response(Bun.file(tempFilePath), {
				headers: { 'Content-Type': contentType },
			})
		);

		// 8. Construct and return public URL
		const publicUrl = `https://${process.env.ASSETS_DOMAIN}/${objectKey}`;
		return publicUrl;
	} catch (error) {
		console.error('Error uploading media to R2:', error);
		throw new Error(
			`Failed to upload media: ${error instanceof Error ? error.message : String(error)}`
		);
	} finally {
		// Clean up temporary file if it exists
		if (tempFilePath) {
			try {
				unlinkSync(tempFilePath);
			} catch (cleanupError) {
				console.warn(`Failed to clean up temporary file ${tempFilePath}:`, cleanupError);
			}
		}
	}
}

/**
 * Deletes a media asset from the R2 bucket
 *
 * @param assetId - The unique identifier/key of the asset (filename in the bucket)
 * @throws Error if deletion fails
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	try {
		await s3.delete(assetId);
	} catch (error) {
		console.error('Error deleting media from R2:', error);
		throw new Error(
			`Failed to delete asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

/**
 * Gets metadata for a media URL
 *
 * @param url - The URL of the media to get metadata for
 * @param recordInfo - Record information to include in the media object
 * @returns A promise resolving to a media insert object or null if processing fails
 */
export async function getMediaInsertData(
	url: string,
	recordInfo: { recordId?: number | null; recordCreatedAt: Date; recordUpdatedAt: Date }
): Promise<MediaInsert | null> {
	try {
		// Get metadata for the media
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(url);

		return {
			url,
			recordId: recordInfo.recordId ?? undefined,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			recordCreatedAt: recordInfo.recordCreatedAt,
			recordUpdatedAt: recordInfo.recordUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', url, error);
		// Include more detailed error information
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Failed to get metadata for ${url}: ${errorMessage}`);
		return null;
	}
}
