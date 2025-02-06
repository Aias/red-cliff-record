import { and, eq, isNull, or } from 'drizzle-orm';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { db } from '~/server/db/connections/postgres';
import {
	indices,
	lightroomImages,
	media,
	recordCreators,
	recordMedia,
	records,
	type LightroomImageSelect,
	type MediaInsert,
	type RecordInsert,
} from '~/server/db/schema';

const generateImageDescription = (image: LightroomImageSelect): string => {
	let description = '';
	if (image.cameraMake) {
		description += `${image.cameraMake}\n`;
	}
	if (image.cameraModel) {
		description += `${image.cameraModel}\n`;
	}
	if (image.cameraLens) {
		description += `${image.cameraLens}\n`;
	}
	if (image.captureDate) {
		description += `${image.captureDate.toLocaleDateString()}\n`;
	}
	if (image.location) {
		description += `${image.location.country}\n`;
	}
	return description;
};

const mapLightroomImageToMedia = async (image: LightroomImageSelect): Promise<MediaInsert> => {
	const { size, width, height, mediaFormat, mediaType, contentTypeString } = await getSmartMetadata(
		image.url2048
	);

	return {
		url: image.url2048,
		type: mediaType,
		format: mediaFormat,
		contentTypeString,
		fileSize: size,
		width,
		height,
		isPrivate: false,
		needsCuration: true,
		recordCreatedAt: image.recordCreatedAt,
		recordUpdatedAt: image.recordUpdatedAt,
		contentCreatedAt: image.captureDate,
		contentUpdatedAt: image.userUpdatedDate,
	};
};

const mapLightroomImageToRecord = (image: LightroomImageSelect): RecordInsert => {
	return {
		type: 'media',
		title: image.fileName,
		content: generateImageDescription(image),
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: image.recordCreatedAt,
		recordUpdatedAt: image.recordUpdatedAt,
		contentCreatedAt: image.contentCreatedAt,
		contentUpdatedAt: image.contentUpdatedAt,
	};
};

export const createMediaFromLightroomImages = async () => {
	const unmappedImages = await db.query.lightroomImages.findMany({
		where: or(isNull(lightroomImages.mediaId), isNull(lightroomImages.recordId)),
		with: {
			media: {
				columns: {
					id: true,
				},
			},
			record: {
				columns: {
					id: true,
				},
			},
		},
	});

	for (const image of unmappedImages) {
		let mediaId: number | undefined;
		let recordId: number | undefined;
		if (!image.media) {
			const newMediaDefaults = await mapLightroomImageToMedia(image);
			const [newMedia] = await db
				.insert(media)
				.values(newMediaDefaults)
				.returning({ id: media.id });
			if (!newMedia) {
				throw new Error('Failed to create media');
			}
			mediaId = newMedia.id;
			await db.update(lightroomImages).set({ mediaId }).where(eq(lightroomImages.id, image.id));
		}
		if (!image.record) {
			const newRecordDefaults = mapLightroomImageToRecord(image);
			const [newRecord] = await db
				.insert(records)
				.values(newRecordDefaults)
				.returning({ id: records.id });
			if (!newRecord) {
				throw new Error('Failed to create record');
			}
			recordId = newRecord.id;
			await db.update(lightroomImages).set({ recordId }).where(eq(lightroomImages.id, image.id));
			const author = await db.query.indices.findFirst({
				where: and(eq(indices.mainType, 'entity'), eq(indices.name, 'Nick Trombley')),
				columns: {
					id: true,
				},
			});
			if (author) {
				await db
					.insert(recordCreators)
					.values({
						recordId,
						entityId: author.id,
						role: 'creator',
					})
					.onConflictDoNothing();
			}
		}
		if (mediaId && recordId) {
			await db
				.insert(recordMedia)
				.values({
					recordId,
					mediaId,
				})
				.onConflictDoNothing();
		}
	}
};
