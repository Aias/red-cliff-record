import { MediaType, type MediaInsert } from '@rcr/data';
import { S3Client } from 'bun';
import mime from 'mime-types';
import { getImageMetadata } from './image-metadata';
import { validateAndFormatUrl } from './url-utils';
import type { MediaMetadata } from '@/shared/types';

/* ---------------------------------------------------------------------------
 * Constants & Defaults
 * -------------------------------------------------------------------------*/
const DEFAULT_MEDIA_TYPE = MediaType.enum.application;
const DEFAULT_MEDIA_FORMAT = 'octet-stream';
const DEFAULT_MIME_TYPE = `${DEFAULT_MEDIA_TYPE}/${DEFAULT_MEDIA_FORMAT}`;

/* ---------------------------------------------------------------------------
 * Environment variable validation
 * -------------------------------------------------------------------------*/
type EnvKey =
	| 'S3_REGION'
	| 'S3_ACCESS_KEY_ID'
	| 'S3_SECRET_ACCESS_KEY'
	| 'S3_BUCKET'
	| 'S3_ENDPOINT'
	| 'ASSETS_DOMAIN';

function getEnv(key: EnvKey): string {
	// Runtime access needs access to process.env
	// This assumes process.env is available during initialization or build
	// or that this runs in an environment where process.env is populated.
	const value = process.env[key];
	if (!value) console.warn(`Warning: ${key} environment variable is not set`);
	return value ?? '';
}

/* ---------------------------------------------------------------------------
 * S3 Client setup using Bun's native S3 API
 * -------------------------------------------------------------------------*/
const BUCKET = getEnv('S3_BUCKET');
const PUBLIC_DOMAIN = getEnv('ASSETS_DOMAIN');

// Create S3 client with credentials from environment
const s3Client = new S3Client({
	accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
	secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
	bucket: BUCKET,
	endpoint: getEnv('S3_ENDPOINT'),
	region: getEnv('S3_REGION') || 'auto',
});

const publicURL = (key: string) => `https://${PUBLIC_DOMAIN}/${key}`;

/* ---------------------------------------------------------------------------
 * Content Type Detection Functions
 * -------------------------------------------------------------------------*/

/**
 * Determines the MediaType based on a filename or file extension.
 * It uses the mime-types library to lookup the mime type, extracts the
 * type component (e.g., "image", "video"), and validates it against the
 * MediaType schema. Defaults to MediaType.enum.application on failure.
 */
export const getMediaType = (filenameOrExt: string): MediaType => {
	const fullMimeType = mime.lookup(filenameOrExt);
	if (!fullMimeType) {
		return DEFAULT_MEDIA_TYPE;
	}
	const type = fullMimeType.split('/')[0];
	const parsed = MediaType.safeParse(type);
	return parsed.success ? parsed.data : DEFAULT_MEDIA_TYPE;
};

/**
 * Validates the URL using zod and returns the mime type based on the
 * pathname of the URL. If the URL is invalid or the mime type cannot be
 * determined, returns 'application/octet-stream'.
 */
export const getMimeTypeFromURL = (url: string): string => {
	try {
		const { success, data } = validateAndFormatUrl(url, true);
		if (!success) {
			return DEFAULT_MIME_TYPE;
		}
		const { pathname } = new URL(data);
		return mime.lookup(pathname) || DEFAULT_MIME_TYPE;
	} catch {
		return DEFAULT_MIME_TYPE;
	}
};

/**
 * Validates the URL using zod and returns the MediaType based on the
 * pathname of the URL. If the URL is invalid, returns the default media type.
 */
export const getMediaTypeFromURL = (url: string): MediaType => {
	try {
		const { success, data } = validateAndFormatUrl(url, true);
		if (!success) {
			return DEFAULT_MEDIA_TYPE;
		}
		const { pathname } = new URL(data);
		return getMediaType(pathname);
	} catch {
		return DEFAULT_MEDIA_TYPE;
	}
};

/**
 * Gets detailed metadata for a media URL
 * For images, includes dimensions and format information
 * For other media types, includes basic size and type information
 *
 * @param url - The URL of the media to analyze
 * @returns Detailed metadata about the media
 * @throws Error if metadata extraction fails
 */
export async function getSmartMetadata(url: string): Promise<MediaMetadata> {
	try {
		const { success, data: validatedUrl } = validateAndFormatUrl(url, true);
		if (!success) {
			throw new Error(`Invalid URL: ${url}`);
		}

		// Start with a HEAD request to get basic info without downloading the entire file
		const headResponse = await fetch(validatedUrl, { method: 'HEAD' });
		let mediaType: MediaType = DEFAULT_MEDIA_TYPE;
		let mediaFormat: string = DEFAULT_MEDIA_FORMAT;
		const contentTypeHeader = headResponse.headers.get('content-type');
		const contentLengthHeader = headResponse.headers.get('content-length');

		if (contentTypeHeader) {
			const { data: typeFromHeaders } = MediaType.safeParse(contentTypeHeader?.split('/')[0] || '');
			mediaType = typeFromHeaders ?? getMediaTypeFromURL(validatedUrl);
			mediaFormat = contentTypeHeader?.split('/')[1] ?? DEFAULT_MEDIA_FORMAT;
		} else {
			mediaType = getMediaTypeFromURL(validatedUrl);
			mediaFormat = new URL(validatedUrl).pathname.split('.').pop() ?? DEFAULT_MEDIA_FORMAT;
		}
		const mimeType = `${mediaType}/${mediaFormat}`;

		// For non-images, return basic info from the HEAD request
		if (mediaType !== 'image') {
			return {
				mediaType,
				mediaFormat,
				contentTypeString: mimeType,
				size: contentLengthHeader ? Number(contentLengthHeader) : undefined,
			};
		}

		// For images, get more detailed metadata
		const response = await fetch(validatedUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch image: HTTP ${response.status}`);
		}

		const buffer = await response.arrayBuffer();
		const metadata = await getImageMetadata(buffer);

		return {
			mediaType,
			mediaFormat: metadata.format ?? mediaFormat,
			contentTypeString: mimeType,
			size: contentLengthHeader ? Number(contentLengthHeader) : metadata.size,
			width: metadata.width,
			height: metadata.height,
			format: metadata.format,
		};
	} catch (error) {
		throw new Error(
			`Failed to get smart metadata for URL: ${url}. ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/* ---------------------------------------------------------------------------
 * Public API – Upload & Delete Functions
 * -------------------------------------------------------------------------*/

/**
 * Downloads a remote media file and uploads it to R2.
 */
export async function uploadMediaToR2(mediaUrl: string): Promise<string> {
	if (mediaUrl.includes(PUBLIC_DOMAIN)) {
		console.log(`Media URL already on R2: ${mediaUrl}`);
		return mediaUrl;
	}

	const startTime = Date.now();
	console.log(`[Media Upload] Starting download: ${mediaUrl}`);

	// 1. Download
	const resp = await fetch(mediaUrl);
	if (!resp.ok) {
		throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
	}

	// 2. Get content size and type
	const contentLength = resp.headers.get('content-length');
	const contentType = resp.headers.get('content-type') ?? getMimeTypeFromURL(mediaUrl);
	const sizeMB = contentLength ? (parseInt(contentLength) / (1024 * 1024)).toFixed(2) : 'unknown';

	console.log(
		`[Media Upload] Downloaded ${sizeMB}MB of ${contentType} in ${Date.now() - startTime}ms`
	);

	// 3. Key generation
	const key = `${crypto.randomUUID()}.${mime.extension(contentType) || 'bin'}`;

	// 4. Upload to R2 using Bun's S3 API
	const uploadStartTime = Date.now();
	console.log(`[Media Upload] Uploading to R2: ${key} (${sizeMB}MB)`);

	const s3File = s3Client.file(key);
	await s3File.write(resp, { type: contentType });

	const totalTime = Date.now() - startTime;
	const uploadTime = Date.now() - uploadStartTime;
	console.log(`[Media Upload] ✓ Complete: ${mediaUrl} → ${publicURL(key)}`);
	console.log(
		`[Media Upload]   Size: ${sizeMB}MB | Download: ${uploadStartTime - startTime}ms | Upload: ${uploadTime}ms | Total: ${totalTime}ms`
	);

	return publicURL(key);
}

/**
 * Uploads a file buffer received from the client to R2.
 */
export async function uploadClientFileToR2(
	fileBuffer: Buffer,
	contentType: string,
	originalFilename?: string
): Promise<string> {
	const key = (() => {
		let ext = mime.extension(contentType);
		if (!ext && originalFilename) {
			const originalExt = originalFilename.split('.').pop();
			if (originalExt) {
				const guessed = mime.lookup(originalExt);
				if (guessed && guessed.startsWith(contentType.split('/')[0]!)) ext = originalExt;
			}
		}
		return `${crypto.randomUUID()}.${ext || 'bin'}`;
	})();

	// Upload to R2 using Bun's S3 API
	const s3File = s3Client.file(key);
	await s3File.write(fileBuffer, { type: contentType });

	console.log(`[uploadClientFileToR2] uploaded ${key}`);
	return publicURL(key);
}

/**
 * Deletes a media asset from R2.
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	const s3File = s3Client.file(assetId);
	await s3File.delete();
	console.log(`Successfully deleted ${assetId} from R2 bucket ${BUCKET}`);
}

/**
 * Returns MediaInsert metadata for a given media URL plus record context.
 */
export async function getMediaInsertData(
	url: string,
	recordData: { recordId?: number | null; recordCreatedAt?: Date; recordUpdatedAt?: Date }
): Promise<MediaInsert | null> {
	try {
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
	} catch (err) {
		console.error('Error getting smart metadata for media', url, err);
		return null;
	}
}
