import { AwsClient } from 'aws4fetch';
import mime from 'mime-types';
import type { MediaInsert } from '@/server/db/schema';
import { MediaType } from '@/server/db/schema/media';
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
 * AwsClient signer (works in Workers + Node18+)
 * -------------------------------------------------------------------------*/
const signer = new AwsClient({
	accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
	secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
	service: 's3',
	region: getEnv('S3_REGION') || 'auto', // R2 ignores the region
});

const BUCKET = getEnv('S3_BUCKET');
const ENDPOINT = getEnv('S3_ENDPOINT').replace(/\/$/, ''); // trim trailing slash
const PUBLIC_DOMAIN = getEnv('ASSETS_DOMAIN');

const r2ObjectURL = (key: string) => `${ENDPOINT}/${BUCKET}/${key}`;
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
 * Core R2 helpers – PUT & DELETE
 * -------------------------------------------------------------------------*/
async function r2Put(key: string, body: BodyInit, contentType: string) {
	const res = await signer.fetch(r2ObjectURL(key), {
		method: 'PUT',
		body,
		headers: { 'content-type': contentType },
	});
	if (!res.ok) throw new Error(`R2 PUT failed: ${res.status} ${res.statusText}`);
}

async function r2Delete(key: string) {
	const res = await signer.fetch(r2ObjectURL(key), { method: 'DELETE' });
	// treat 404 as success (object already gone)
	if (!res.ok && res.status !== 404) {
		throw new Error(`R2 DELETE failed: ${res.status} ${res.statusText}`);
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

	// 1 Download
	const resp = await fetch(mediaUrl);
	if (!resp.ok) {
		throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
	}
	const buffer = Buffer.from(await resp.arrayBuffer());

	// 2 Content‑type detection
	let contentType = resp.headers.get('content-type') ?? '';
	if (!contentType) contentType = getMimeTypeFromURL(mediaUrl);

	// 3 Key generation
	const key = `${crypto.randomUUID()}.${mime.extension(contentType) || 'bin'}`;

	// 4 PUT to R2
	await r2Put(key, buffer, contentType);
	console.log(`Successfully uploaded ${mediaUrl} → ${publicURL(key)}`);
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

	await r2Put(key, fileBuffer, contentType);
	console.log(`[uploadClientFileToR2] uploaded ${key}`);
	return publicURL(key);
}

/**
 * Deletes a media asset from R2.
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	await r2Delete(assetId);
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
