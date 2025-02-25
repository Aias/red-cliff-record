import { validateAndFormatUrl } from '@/app/lib/formatting';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import type { MediaInsert } from '@/server/db/schema';
import { uploadMediaToR2 } from './media-helpers';

/**
 * Maps a URL string to a validated URL
 *
 * @param url - The URL to validate and format
 * @returns The validated URL or undefined if invalid
 */
export function mapUrl(url?: string | null): string | undefined {
	if (!url) return undefined;

	try {
		const { success, data } = validateAndFormatUrl(url, true);
		return success ? data : undefined;
	} catch {
		console.error('Invalid URL:', url);
		return undefined;
	}
}

/**
 * Uploads media to R2 storage
 *
 * @param url - The URL of the media to upload
 * @returns A promise resolving to the new URL after upload
 * @throws Error if upload fails with detailed error message
 */
export async function uploadToR2(url: string): Promise<string> {
	try {
		return await uploadMediaToR2(url);
	} catch (error) {
		console.error('Error uploading media to R2', url, error);
		throw new Error(
			`Failed to upload media to R2: ${error instanceof Error ? error.message : String(error)}`
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
export async function getMediaMetadata(
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

/**
 * Maps a media source to a media insert object
 * This function handles both uploading to R2 (if requested) and getting metadata
 *
 * @param source - The source object with media URL and record information
 * @param options - Options for processing the media
 * @returns A promise resolving to a media insert object or null if processing fails
 */
export async function mapToMedia(
	source: { url: string; recordId?: number | null; recordCreatedAt: Date; recordUpdatedAt: Date },
	options: { uploadToR2?: boolean } = {}
): Promise<MediaInsert | null> {
	const { url, recordId, recordCreatedAt, recordUpdatedAt } = source;
	const { uploadToR2: shouldUpload = true } = options;

	try {
		// Upload to R2 if requested
		const mediaUrl = shouldUpload ? await uploadToR2(url) : url;

		// Get metadata and create media object
		return await getMediaMetadata(mediaUrl, { recordId, recordCreatedAt, recordUpdatedAt });
	} catch (error) {
		console.error('Failed to process media:', error);
		return null;
	}
}
