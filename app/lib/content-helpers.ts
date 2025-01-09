import mime from 'mime-types';
import { FLAGS, MediaFormat, type Flag } from '@schema/main/types';

export const extensions: { [key: string]: string } = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
};

export const getContentTypeFromExtension = (extension: string): string => {
	return extensions[extension.toLowerCase()] || 'application/octet-stream';
};

export const getExtensionFromContentType = (contentType: string | null): string | null => {
	if (!contentType) return null;

	for (const [ext, mime] of Object.entries(extensions)) {
		if (mime === contentType) {
			return ext;
		}
	}

	return null;
};

// Helper function for determining format from mime type
export const getMediaFormat = (contentTypeOrExtension: string): MediaFormat => {
	const fullMimeType = mime.lookup(contentTypeOrExtension);
	if (!fullMimeType) {
		return MediaFormat.enum.unknown;
	}
	const type = fullMimeType.split('/')[0];
	switch (type) {
		case 'image':
			return MediaFormat.enum.image;
		case 'video':
			return MediaFormat.enum.video;
		case 'audio':
			return MediaFormat.enum.audio;
		case 'text':
			return MediaFormat.enum.text;
		case 'application':
			return MediaFormat.enum.application;
		default:
			return MediaFormat.enum.unknown;
	}
};

export const getFlagName = (flag: Flag): string => FLAGS[flag].name;
export const getFlagEmoji = (flag: Flag): string => FLAGS[flag].emoji;
export const getFlagDescription = (flag: Flag): string => FLAGS[flag].description;
