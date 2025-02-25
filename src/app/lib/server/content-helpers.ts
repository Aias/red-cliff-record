import mime from 'mime-types';
import sharp from 'sharp';
import { validateAndFormatUrl } from '@/app/lib/formatting';
import { MediaType } from '@/server/db/schema/media';

const DEFAULT_MEDIA_TYPE = MediaType.enum.application;
const DEFAULT_MEDIA_FORMAT = 'octet-stream';
const DEFAULT_MIME_TYPE = `${DEFAULT_MEDIA_TYPE}/${DEFAULT_MEDIA_FORMAT}`;

// -----------------------------------------------------------------
// Function: getMediaFormat
// Description: Determines the MediaFormat based on a filename or file extension.
//              It uses the mime-types library to lookup the mime type, extracts the
//              type component (e.g., "image", "video"), and validates it against the
//              MediaFormat schema. Defaults to MediaFormat.enum.application on failure.
// -----------------------------------------------------------------
export const getMediaType = (filenameOrExt: string): MediaType => {
	const fullMimeType = mime.lookup(filenameOrExt);
	if (!fullMimeType) {
		return DEFAULT_MEDIA_TYPE;
	}
	const type = fullMimeType.split('/')[0];
	const parsed = MediaType.safeParse(type);
	return parsed.success ? parsed.data : DEFAULT_MEDIA_TYPE;
};

// -----------------------------------------------------------------
// Function: getMimeTypeFromURL
// Description: Validates the URL using zod and returns the mime type based on the
//              pathname of the URL. If the URL is invalid or the mime type cannot be
//              determined, returns 'application/octet-stream'.
// -----------------------------------------------------------------
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

// -----------------------------------------------------------------
// Function: getMediaTypeFromURL
// Description: Validates the URL using zod and returns the MediaType based on the
//              pathname of the URL. If the URL is invalid, returns the default media type.
// -----------------------------------------------------------------
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

export type MediaMetadata = {
	mediaType: MediaType;
	mediaFormat: string;
	contentTypeString: string;
	size?: number;
	width?: number;
	height?: number;
	format?: string;
	hasAlpha?: boolean;
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
		const metadata = await sharp(buffer).metadata();

		return {
			mediaType,
			mediaFormat: metadata.format ?? mediaFormat,
			contentTypeString: mimeType,
			size: contentLengthHeader ? Number(contentLengthHeader) : metadata.size,
			width: metadata.width,
			height: metadata.height,
			format: metadata.format,
			hasAlpha: metadata.hasAlpha,
		};
	} catch (error) {
		throw new Error(
			`Failed to get smart metadata for URL: ${url}. ${error instanceof Error ? error.message : String(error)}`
		);
	}
}
