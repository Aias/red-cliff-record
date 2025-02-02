import mime from 'mime-types';
import sharp from 'sharp';
import { z } from 'zod';
import { FLAGS, MediaType, type Flag } from '~/server/db/schema/main';

const urlSchema = z.string().url();
const DEFAULT_MEDIA_TYPE = MediaType.enum.application;
const DEFAULT_MIME_TYPE = 'application/octet-stream';

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
// Flag Helper Functions
// -----------------------------------------------------------------
export const getFlagName = (flag: Flag): string => FLAGS[flag].name;
export const getFlagEmoji = (flag: Flag): string => FLAGS[flag].emoji;
export const getFlagDescription = (flag: Flag): string => FLAGS[flag].description;

// -----------------------------------------------------------------
// Function: getMimeTypeFromURL
// Description: Validates the URL using zod and returns the mime type based on the
//              pathname of the URL. If the URL is invalid or the mime type cannot be
//              determined, returns 'application/octet-stream'.
// -----------------------------------------------------------------
export const getMimeTypeFromURL = (url: string): string => {
	const parsedUrl = urlSchema.safeParse(url);
	if (!parsedUrl.success) {
		return DEFAULT_MIME_TYPE;
	}
	const { pathname } = new URL(parsedUrl.data);
	return mime.lookup(pathname) || DEFAULT_MIME_TYPE;
};

// -----------------------------------------------------------------
// Function: getMediaTypeFromURL
// Description: Validates the URL using zod and returns the MediaType based on the
//              pathname of the URL. If the URL is invalid, returns the default media type.
// -----------------------------------------------------------------
export const getMediaTypeFromURL = (url: string): MediaType => {
	const parsedUrl = urlSchema.safeParse(url);
	if (!parsedUrl.success) {
		return DEFAULT_MEDIA_TYPE;
	}
	const { pathname } = new URL(parsedUrl.data);
	return getMediaType(pathname);
};

export type MediaMetadata = {
	mediaType: MediaType;
	mediaFormat: string;
	contentTypeString: string;
	size: number;
	width?: number;
	height?: number;
	format?: string;
	hasAlpha?: boolean;
};

export async function getSmartMetadata(url: string): Promise<MediaMetadata> {
	const validatedUrl = z.string().url().parse(url);

	// Start with a HEAD request
	const headResponse = await fetch(validatedUrl, { method: 'HEAD' });
	let mediaType: MediaType;
	const contentTypeHeader = headResponse.headers.get('content-type')?.split('/')[0];
	const { data: typeFromHeaders } = MediaType.safeParse(contentTypeHeader || '');
	if (typeFromHeaders) {
		mediaType = typeFromHeaders;
	} else {
		mediaType = getMediaTypeFromURL(validatedUrl);
	}
	const mimeType = getMimeTypeFromURL(validatedUrl); // Get base MIME type without parameters

	// If it's an image, get more details
	if (mediaType === 'image') {
		const response = await fetch(validatedUrl);
		const buffer = await response.arrayBuffer();
		const metadata = await sharp(buffer).metadata();

		return {
			mediaType: mediaType,
			mediaFormat: metadata.format ?? 'octet-stream',
			contentTypeString: mimeType,
			size: Number(headResponse.headers.get('content-length') ?? metadata.size ?? 0),
			width: metadata.width,
			height: metadata.height,
			format: metadata.format,
			hasAlpha: metadata.hasAlpha,
		};
	}

	// For non-images, return basic info
	return {
		mediaType,
		mediaFormat: 'octet-stream',
		contentTypeString: mimeType,
		size: Number(headResponse.headers.get('content-length') ?? 0),
	};
}
