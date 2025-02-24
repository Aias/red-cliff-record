import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import { db } from '@/server/db/connections/postgres';
import {
	lightroomImages,
	media,
	recordCreators,
	records,
	type LightroomImageSelect,
	type MediaInsert,
	type RecordInsert,
} from '@/server/db/schema';
import { uploadMediaToR2 } from '../common/media-helpers';

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
	let newUrl: string;
	try {
		console.log('Uploading media to R2', image.url2048);
		newUrl = await uploadMediaToR2(image.url2048);
	} catch (error) {
		console.error('Error uploading media to R2', image.url2048, error);
		return null;
	}

	try {
		console.log('Getting smart metadata for media', newUrl);
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(newUrl);

		return {
			url: newUrl,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			recordId: image.recordId,
			recordCreatedAt: image.recordCreatedAt,
			recordUpdatedAt: image.recordUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', image.url2048, error);
		return null;
	}
};

const mapLightroomImageToRecord = (image: LightroomImageSelect): RecordInsert => {
	return {
		title: image.fileName,
		type: 'artifact',
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
		let mediaId: number | null = image.media?.id ?? null;
		let recordId: number | null = image.record?.id ?? null;
		if (!mediaId) {
			console.log(`Creating media for ${image.fileName}`);
			const newMediaDefaults = await mapLightroomImageToMedia(image);
			if (!newMediaDefaults) {
				console.log(`Failed to create media for ${image.fileName}`);
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
			const author = await db.query.records.findFirst({
				where: and(eq(records.type, 'entity'), eq(records.title, 'Nick Trombley')),
				columns: {
					id: true,
				},
			});
			if (author) {
				await db
					.insert(recordCreators)
					.values({
						recordId,
						creatorId: author.id,
						creatorRole: 'creator',
					})
					.onConflictDoNothing();
			}
		}
		if (mediaId && recordId) {
			console.log(`Linking media ${mediaId} to record ${recordId}`);
			await db
				.update(media)
				.set({
					recordId,
				})
				.where(eq(media.id, mediaId));
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
		console.log(`Linking media ${image.mediaId} to record ${image.recordId}`);
		await db
			.update(media)
			.set({
				recordId: image.recordId!,
			})
			.where(eq(media.id, image.mediaId!));
	}
};
