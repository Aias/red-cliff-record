import mime from 'mime-types';
import { FLAGS, MediaFormat, type Flag } from '~/server/db/schema/main';

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
