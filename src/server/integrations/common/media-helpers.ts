import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { S3Client } from 'bun';
import { extension as mimeExtension, lookup as mimeLookup } from 'mime-types';
import sharp from 'sharp';

// Create the S3 client for Cloudflare R2 (or any S3-compatible endpoint).
// Ensure you have these environment variables set: S3_REGION, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY, S3_BUCKET, and S3_ENDPOINT.
const s3 = new S3Client({
	region: process.env.S3_REGION!,
	accessKeyId: process.env.S3_ACCESS_KEY_ID!,
	secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	bucket: process.env.S3_BUCKET!,
	endpoint: process.env.S3_ENDPOINT!,
});

/**
 * Downloads a remote media file, optionally processes it,
 * then uploads it to the S3/R2 bucket, returning a permanent public URL.
 *
 * @param mediaUrl - The remote URL of the media to download
 * @returns A publicly accessible (non-expiring) S3/R2 URL
 */
export async function uploadMediaToR2(mediaUrl: string): Promise<string> {
	// 1. Fetch the remote file
	const resp = await fetch(mediaUrl);
	if (!resp.ok) {
		throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
	}

	// Attempt to read Content-Type header
	let contentType = resp.headers.get('content-type') || '';

	// If not provided or empty, fall back to mimeLookup by extension
	if (!contentType) {
		const pathname = new URL(mediaUrl).pathname; // e.g. "/images/pic.jpg"
		const guess = mimeLookup(pathname); // e.g. "image/jpeg"
		contentType = guess || 'application/octet-stream';
	}

	// 2. Write the file to a temporary location in ".temp/media"
	//    (Make sure this folder exists)
	const tempDir = '.temp/media';
	mkdirSync(tempDir, { recursive: true });

	const arrayBuffer = await resp.arrayBuffer();

	const uniqueName = randomUUID();
	// Attempt a file extension based on the final Content-Type
	const ext = mimeExtension(contentType) || 'bin';
	const tempFilePath = `${tempDir}/${uniqueName}.${ext}`;

	// Write the downloaded bytes to disk
	await Bun.write(tempFilePath, new Uint8Array(arrayBuffer));

	// -- OPTIONAL MIDDLEWARE / PROCESSING STEP HERE --
	// e.g., image resizing, compression, etc.
	// For now, it's just a placeholder:
	//   await optimizeMedia(tempFilePath, { contentType });

	// 3. Re-upload to your S3/R2 bucket
	// Generate an object key (filename) in the bucket:
	const newObjectKey = `${uniqueName}.${ext}`;

	// Use S3Client.write() with your known or chosen ACL if needed
	await s3.write(
		newObjectKey,
		new Response(Bun.file(tempFilePath), {
			headers: { 'Content-Type': contentType },
		})
	);

	// 4. Construct a permanent public URL using the custom domain
	const publicUrl = `https://${process.env.ASSETS_DOMAIN}/${newObjectKey}`;

	return publicUrl;
}

/**
 * Deletes a media asset from the R2 bucket by its ID/key
 *
 * @param assetId - The unique identifier/key of the asset (e.g., "123e4567-e89b-12d3-a456-426614174000.jpg")
 * @throws Error if deletion fails
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	try {
		await s3.delete(assetId);
	} catch (error) {
		throw new Error(
			`Failed to delete asset ${assetId}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

export type MediaMetadata = {
	contentType: string;
	size: number;
	width?: number;
	height?: number;
	format?: string;
	hasAlpha?: boolean;
};

export async function getSmartMetadata(url: string): Promise<MediaMetadata> {
	// Start with a HEAD request
	const headResponse = await fetch(url, { method: 'HEAD' });
	const contentType =
		headResponse.headers.get('content-type') ||
		mimeLookup(new URL(url).pathname) ||
		'application/octet-stream';

	// If it's an image, get more details
	if (contentType.startsWith('image/')) {
		const response = await fetch(url);
		const buffer = await response.arrayBuffer();
		const metadata = await sharp(buffer).metadata();

		return {
			contentType,
			size: Number(headResponse.headers.get('content-length')),
			width: metadata.width,
			height: metadata.height,
			format: metadata.format,
			hasAlpha: metadata.hasAlpha,
		};
	}

	// For non-images, return basic info
	return {
		contentType,
		size: Number(headResponse.headers.get('content-length')),
	};
}
