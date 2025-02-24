import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { S3Client } from 'bun';
import { eq, ilike } from 'drizzle-orm';
import { extension as mimeExtension, lookup as mimeLookup } from 'mime-types';
import { db } from '@/server/db/connections/postgres';
import { media } from '@/server/db/schema/media';

// Environment variable validation
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

	try {
		// 1. Fetch the remote file
		const resp = await fetch(mediaUrl);
		if (!resp.ok) {
			throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
		}

		// 2. Determine content type
		let contentType = resp.headers.get('content-type') || '';

		// If content type not provided, guess from URL
		if (!contentType) {
			const pathname = new URL(mediaUrl).pathname;
			const guess = mimeLookup(pathname);
			contentType = guess || 'application/octet-stream';
		}

		// 3. Create temp directory if it doesn't exist
		mkdirSync(TEMP_MEDIA_DIR, { recursive: true });

		// 4. Download file content
		const arrayBuffer = await resp.arrayBuffer();

		// 5. Generate unique filename with appropriate extension
		const uniqueName = randomUUID();
		const ext = mimeExtension(contentType) || 'bin';
		const tempFilePath = `${TEMP_MEDIA_DIR}/${uniqueName}.${ext}`;
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
 * Transfers media from external URLs to R2 storage
 *
 * This function:
 * 1. Finds media records matching the search term
 * 2. Uploads each media to R2
 * 3. Updates the database records with the new R2 URLs
 *
 * @param searchTerm - SQL LIKE pattern to match media URLs
 * @returns Promise that resolves when all transfers are complete
 */
export async function transferMediaToR2(searchTerm: string): Promise<void> {
	// Find media records matching the search pattern
	const mediaToTransfer = await db.query.media.findMany({
		where: ilike(media.url, searchTerm),
	});

	console.log(`Found ${mediaToTransfer.length} media items to transfer`);

	// Process each media item
	for (const m of mediaToTransfer) {
		try {
			console.log(`Transferring ${m.url}`);
			const r2Url = await uploadMediaToR2(m.url);
			console.log(`Uploaded to R2: ${r2Url}`);

			// Update the database record with the new URL
			await db
				.update(media)
				.set({ url: r2Url, recordUpdatedAt: new Date() })
				.where(eq(media.id, m.id));
		} catch (error) {
			console.error(`Failed to transfer media ${m.id}:`, error);
			// Continue with next item instead of failing the entire batch
		}
	}
}
