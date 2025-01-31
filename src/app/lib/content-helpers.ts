import mime from 'mime-types';
import { z } from 'zod';
import { FLAGS, MediaFormat, type Flag } from '~/server/db/schema/main';

const urlSchema = z.string().url();
const DEFAULT_MEDIA_FORMAT = MediaFormat.enum.application;
const DEFAULT_MIME_TYPE = 'application/octet-stream';

// -----------------------------------------------------------------
// Function: getMediaFormat
// Description: Determines the MediaFormat based on a filename or file extension.
//              It uses the mime-types library to lookup the mime type, extracts the
//              type component (e.g., "image", "video"), and validates it against the
//              MediaFormat schema. Defaults to MediaFormat.enum.application on failure.
// -----------------------------------------------------------------
export const getMediaFormat = (filenameOrExt: string): MediaFormat => {
	const fullMimeType = mime.lookup(filenameOrExt);
	if (!fullMimeType) {
		return DEFAULT_MEDIA_FORMAT;
	}
	const type = fullMimeType.split('/')[0];
	const parsed = MediaFormat.safeParse(type);
	return parsed.success ? parsed.data : DEFAULT_MEDIA_FORMAT;
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
// Function: getMediaFormatFromURL
// Description: Validates the URL using zod and returns the MediaFormat based on the
//              pathname of the URL. If the URL is invalid, returns the default media format.
// -----------------------------------------------------------------
export const getMediaFormatFromURL = (url: string): MediaFormat => {
	const parsedUrl = urlSchema.safeParse(url);
	if (!parsedUrl.success) {
		return DEFAULT_MEDIA_FORMAT;
	}
	const { pathname } = new URL(parsedUrl.data);
	return getMediaFormat(pathname);
};
