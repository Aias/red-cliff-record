import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import mime from 'mime-types';
import type { MediaInsert } from '@/server/db/schema';
import { getMimeTypeFromURL, getSmartMetadata } from './content-helpers';

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
 * S3 client for Cloudflare R2 (using AWS SDK v3)
 */
const s3Client = new S3Client({
	region: process.env.S3_REGION!,
	endpoint: process.env.S3_ENDPOINT!,
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID!,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	},
});

/**
 * Downloads a remote media file and uploads it directly (streams) to the S3/R2 bucket
 *
 * This function:
 * 1. Checks if the media is already on R2
 * 2. Fetches the remote file using standard fetch
 * 3. Determines the content type
 * 4. Streams the response body directly to S3/R2 using PutObjectCommand
 * 5. Returns the public URL
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

	try {
		// 1. Fetch the remote file
		const resp = await fetch(mediaUrl);
		if (!resp.ok) {
			throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
		}

		// 2. Buffer the response instead of streaming
		const buffer = Buffer.from(await resp.arrayBuffer());

		// 3. Determine content type
		let contentType = resp.headers.get('content-type') || '';

		// If content type not provided, guess from URL using the centralized function
		if (!contentType) {
			contentType = getMimeTypeFromURL(mediaUrl);
		}

		// 4. Generate unique filename (object key) with appropriate extension
		const uniqueName = crypto.randomUUID();
		const ext = mime.extension(contentType) || 'bin';
		const objectKey = `${uniqueName}.${ext}`;

		// 5. Prepare and execute S3 Upload Command with buffered data
		const putCommand = new PutObjectCommand({
			Bucket: process.env.S3_BUCKET!,
			Key: objectKey,
			Body: buffer,
			ContentType: contentType,
			ContentLength: buffer.length,
		});

		await s3Client.send(putCommand);

		// 6. Construct and return public URL
		const publicUrl = `https://${process.env.ASSETS_DOMAIN}/${objectKey}`;
		console.log(`Successfully uploaded ${mediaUrl} to ${publicUrl}`);
		return publicUrl;
	} catch (error) {
		console.error('Error uploading media to R2:', error);
		throw new Error(
			`Failed to stream media: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Uploads a file buffer directly to the S3/R2 bucket.
 *
 * This is intended for files received directly from the client-side upload,
 * rather than files fetched from another URL.
 *
 * @param fileBuffer The file content as a Buffer.
 * @param contentType The MIME type of the file.
 * @param originalFilename Optional: Original filename to help determine extension.
 * @returns A publicly accessible (non-expiring) S3/R2 URL.
 * @throws Error if upload fails.
 */
export async function uploadClientFileToR2(
	fileBuffer: Buffer,
	contentType: string,
	originalFilename?: string
): Promise<string> {
	try {
		// Generate unique filename (object key) with appropriate extension
		const uniqueName = crypto.randomUUID();
		let ext = mime.extension(contentType);
		if (!ext && originalFilename) {
			const originalExt = originalFilename.split('.').pop();
			if (originalExt) {
				// Basic check if the extracted extension matches a known mime type
				const guessedMime = mime.lookup(originalExt);
				if (guessedMime && guessedMime.startsWith(contentType.split('/')[0]!)) {
					ext = originalExt;
				}
			}
		}
		ext = ext || 'bin'; // Fallback to 'bin' if no suitable extension found
		const objectKey = `${uniqueName}.${ext}`;

		// Prepare and execute S3 Upload Command
		const putCommand = new PutObjectCommand({
			Bucket: process.env.S3_BUCKET!,
			Key: objectKey,
			Body: fileBuffer,
			ContentType: contentType,
			ContentLength: fileBuffer.length,
		});

		await s3Client.send(putCommand);

		// Construct and return public URL
		const publicUrl = `https://${process.env.ASSETS_DOMAIN}/${objectKey}`;
		console.log(`Successfully uploaded client file to ${publicUrl}`);
		return publicUrl;
	} catch (error) {
		console.error('Error uploading client file to R2:', error);
		throw new Error(
			`Failed to upload client file: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Deletes a media asset from the R2 bucket using AWS SDK
 *
 * @param assetId - The unique identifier/key of the asset (filename in the bucket)
 * @throws Error if deletion fails
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	try {
		const deleteCommand = new DeleteObjectCommand({
			Bucket: process.env.S3_BUCKET!,
			Key: assetId,
		});
		await s3Client.send(deleteCommand);
		console.log(`Successfully deleted ${assetId} from R2 bucket ${process.env.S3_BUCKET!}`);
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
	recordData: { recordId?: number | null; recordCreatedAt?: Date; recordUpdatedAt?: Date }
): Promise<MediaInsert | null> {
	try {
		// Get metadata for the media
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(url);
		const { recordId, recordCreatedAt, recordUpdatedAt } = recordData;

		return {
			url,
			recordId,
			recordCreatedAt,
			recordUpdatedAt,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', url, error);
		// Include more detailed error information
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Failed to get metadata for ${url}: ${errorMessage}`);
		return null;
	}
}
