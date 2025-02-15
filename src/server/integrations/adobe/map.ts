import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
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

const mapLightroomImageToMedia = async (
	image: LightroomImageSelect
): Promise<MediaInsert | null> => {
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(image.url2048);

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
			sources: ['lightroom'],
			recordCreatedAt: image.recordCreatedAt,
			recordUpdatedAt: image.recordUpdatedAt,
			contentCreatedAt: image.captureDate,
			contentUpdatedAt: image.userUpdatedDate,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', image.url2048, error);
		return null;
	}
};

const mapLightroomImageToRecord = (image: LightroomImageSelect): RecordInsert => {
	return {
		title: image.fileName,
		content: generateImageDescription(image),
		needsCuration: true,
		isPrivate: false,
		sources: ['lightroom'],
		recordCreatedAt: image.recordCreatedAt,
		recordUpdatedAt: image.recordUpdatedAt,
		contentCreatedAt: image.contentCreatedAt,
		contentUpdatedAt: image.contentUpdatedAt,
	};
};

export const createMediaFromLightroomImages = async () => {
	console.log('Creating media from Lightroom images');
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
			console.log(`Creating media for ${image.fileName}`);
			const newMediaDefaults = await mapLightroomImageToMedia(image);
			if (!newMediaDefaults) {
				console.log(`Failed to create media for ${image.fileName}`);
				continue;
			}
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
			console.log(`Creating record for ${image.fileName}`);
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
			console.log(`Linking media ${mediaId} to record ${recordId}`);
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

export const createRecordMediaLinks = async () => {
	const images = await db.query.lightroomImages.findMany({
		where: and(isNotNull(lightroomImages.recordId), isNotNull(lightroomImages.mediaId)),
		columns: {
			id: true,
			recordId: true,
			mediaId: true,
		},
	});

	for (const image of images) {
		await db
			.insert(recordMedia)
			.values({
				recordId: image.recordId!,
				mediaId: image.mediaId!,
			})
			.onConflictDoNothing();
	}
};
