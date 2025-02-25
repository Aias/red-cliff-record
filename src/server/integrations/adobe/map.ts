import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import {
	lightroomImages,
	media,
	records,
	type LightroomImageSelect,
	type MediaInsert,
	type RecordInsert,
} from '@/server/db/schema';
import { linkRecordToCreator } from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';
import { getMediaInsertData, uploadMediaToR2 } from '../common/media-helpers';

const logger = createIntegrationLogger('adobe', 'map');

const generateImageDescription = (image: LightroomImageSelect): string => {
	const parts: string[] = [];

	if (image.cameraMake) parts.push(image.cameraMake);
	if (image.cameraModel) parts.push(image.cameraModel);
	if (image.cameraLens) parts.push(image.cameraLens);
	if (image.captureDate) parts.push(image.captureDate.toLocaleDateString());
	if (image.location?.country) parts.push(image.location.country);

	return parts.join('\n');
};

const mapLightroomImageToMedia = async (
	image: LightroomImageSelect
): Promise<MediaInsert | null> => {
	// Upload to R2 (the function internally checks if it's already an R2 URL)
	const newUrl = await uploadMediaToR2(image.url2048);
	if (!newUrl) {
		logger.error(`Failed to upload image to R2: ${image.url2048}`);
		return null;
	}

	// Update the URL in the lightroomImages table if it changed
	if (newUrl !== image.url2048) {
		await db
			.update(lightroomImages)
			.set({ url2048: newUrl })
			.where(eq(lightroomImages.id, image.id));
		logger.info(`Updated Lightroom image URL from ${image.url2048} to ${newUrl}`);
	}

	// Get metadata for the URL
	return getMediaInsertData(newUrl, {
		recordId: image.recordId,
		recordCreatedAt: image.recordCreatedAt,
		recordUpdatedAt: image.recordUpdatedAt,
	});
};

const mapLightroomImageToRecord = (image: LightroomImageSelect): RecordInsert => {
	return {
		id: image.recordId ?? undefined,
		type: 'artifact',
		title: image.fileName,
		content: generateImageDescription(image),
		needsCuration: true,
		isPrivate: false,
		sources: ['lightroom'],
		avatarUrl: `${image.baseUrl}${image.links['/rels/rendition_type/thumbnail2x'].href}`,
		recordCreatedAt: image.recordCreatedAt,
		recordUpdatedAt: image.recordUpdatedAt,
		contentCreatedAt: image.captureDate,
		contentUpdatedAt: image.userUpdatedDate,
	};
};

export const createMediaFromLightroomImages = async () => {
	logger.start('Creating media from Lightroom images');

	// Find images that don't have media or records yet
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

	logger.info(`Found ${unmappedImages.length} unmapped Lightroom images`);

	for (const image of unmappedImages) {
		let mediaId: number | null = image.media?.id ?? null;
		let recordId: number | null = image.record?.id ?? null;

		// Create media if needed
		if (!mediaId) {
			logger.info(`Creating media for ${image.fileName}`);
			const newMediaDefaults = await mapLightroomImageToMedia(image);

			if (!newMediaDefaults) {
				logger.error(`Failed to create media for ${image.fileName}`);
				continue;
			}

			// Update the url2048 to the new url so subsequent runs don't try to upload again
			await db
				.update(lightroomImages)
				.set({ url2048: newMediaDefaults.url })
				.where(eq(lightroomImages.id, image.id));

			const [newMedia] = await db
				.insert(media)
				.values(newMediaDefaults)
				.onConflictDoUpdate({
					target: media.id,
					set: {
						recordUpdatedAt: new Date(),
					},
				})
				.returning({ id: media.id });

			if (!newMedia) {
				throw new Error('Failed to create media');
			}

			mediaId = newMedia.id;
			await db.update(lightroomImages).set({ mediaId }).where(eq(lightroomImages.id, image.id));

			logger.info(`Created media ${mediaId} for ${image.fileName}`);
		}

		// Create record if needed
		if (!image.record) {
			logger.info(`Creating record for ${image.fileName}`);
			const newRecordDefaults = mapLightroomImageToRecord(image);

			const [newRecord] = await db
				.insert(records)
				.values(newRecordDefaults)
				.onConflictDoUpdate({
					target: records.id,
					set: {
						recordUpdatedAt: new Date(),
					},
				})
				.returning({ id: records.id });

			if (!newRecord) {
				throw new Error('Failed to create record');
			}

			recordId = newRecord.id;
			await db.update(lightroomImages).set({ recordId }).where(eq(lightroomImages.id, image.id));

			// Link to author if found
			const author = await db.query.records.findFirst({
				where: and(eq(records.type, 'entity'), eq(records.title, 'Nick Trombley')),
				columns: {
					id: true,
				},
			});

			if (author) {
				await linkRecordToCreator(recordId, author.id, 'creator');
			}

			logger.info(`Created record ${recordId} for ${image.fileName}`);
		}

		// Link media to record if both exist
		if (mediaId && recordId) {
			logger.info(`Linking media ${mediaId} to record ${recordId}`);
			await db
				.update(media)
				.set({
					recordId,
				})
				.where(eq(media.id, mediaId));
		}
	}

	logger.complete(`Processed ${unmappedImages.length} Lightroom images`);
};

export const createRecordMediaLinks = async () => {
	logger.start('Creating record-media links for Lightroom images');

	const images = await db.query.lightroomImages.findMany({
		where: and(isNotNull(lightroomImages.recordId), isNotNull(lightroomImages.mediaId)),
		columns: {
			id: true,
			recordId: true,
			mediaId: true,
		},
	});

	logger.info(`Found ${images.length} Lightroom images with both record and media IDs`);

	for (const image of images) {
		logger.info(`Linking media ${image.mediaId} to record ${image.recordId}`);
		await db
			.update(media)
			.set({
				recordId: image.recordId!,
			})
			.where(eq(media.id, image.mediaId!));
	}

	logger.complete(`Linked ${images.length} media items to records`);
};
