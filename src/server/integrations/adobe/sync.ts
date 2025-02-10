import { db } from '~/server/db/connections';
import { lightroomImages } from '~/server/db/schema/adobe';
import { transferMediaToR2 } from '../common/media-helpers';
import { runIntegration } from '../common/run-integration';
import { createMediaFromLightroomImages } from './map';
import { LightroomJsonResponseSchema } from './types';

// TODO: Fix this sync, the photo URLs stop working if the image is removed from the album.

const ALBUM_URL =
	'https://lightroom.adobe.com/v2/spaces/f89a3c5060d8467a952c66de97edbe39/albums/f1edd4179e2f4e1d802f8a94f40b542c/assets?embed=asset%3Buser&order_after=-&exclude=incomplete&subtype=image';

async function syncLightroomImages(integrationRunId: number) {
	console.log('📷 Fetching Lightroom album data...');
	const response = await fetch(ALBUM_URL, {
		headers: {
			Authorization: `Bearer ${process.env.ADOBE_API_TOKEN}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Lightroom API request failed with status ${response.status}`);
	}

	const textData = await response.text();
	const jsonData = LightroomJsonResponseSchema.parse(
		JSON.parse(textData.replace(/^while\s*\(1\)\s*{\s*}\s*/, ''))
	);

	console.log(`✅ Retrieved ${jsonData.resources.length} resources from Lightroom`);

	const baseUrl = jsonData.base;

	let successCount = 0;
	for (const resource of jsonData.resources) {
		const asset = resource.asset;
		const { payload, created, updated, links, id } = asset;
		const {
			importSource,
			autoTags,
			develop,
			changedOnDevice,
			xmp,
			location,
			ratings,
			aesthetics,
			captureDate,
			userUpdated,
		} = payload;
		const url2048 = `${baseUrl}${asset.links['/rels/rendition_type/2048'].href}`;
		const firstRatingKey = ratings ? Object.keys(ratings)[0] : undefined;
		const rating = firstRatingKey && ratings ? (ratings[firstRatingKey]?.rating ?? 0) : 0;

		const imageToInsert = {
			id: id,
			url2048,
			links: links,
			fileName: importSource.fileName,
			contentType: importSource.contentType,
			sourceDevice: changedOnDevice ?? importSource.importedOnDevice ?? develop.device,
			cameraMake: xmp.tiff.Make,
			cameraModel: xmp.tiff.Model,
			cameraLens: xmp.aux.Lens,
			captureDate: captureDate,
			userUpdatedDate: userUpdated,
			fileSize: importSource.fileSize,
			croppedWidth: develop.croppedWidth,
			croppedHeight: develop.croppedHeight,
			aesthetics: aesthetics,
			exif: xmp.exif,
			location: location,
			rating: rating,
			autoTags: Object.keys(autoTags.tags),
			contentCreatedAt: created,
			contentUpdatedAt: updated,
			integrationRunId: integrationRunId,
		};

		try {
			await db
				.insert(lightroomImages)
				.values(imageToInsert)
				.onConflictDoUpdate({
					target: lightroomImages.id,
					set: { ...imageToInsert, recordUpdatedAt: new Date() },
				});
			successCount++;
		} catch (error) {
			console.error('Error processing image:', {
				image: imageToInsert,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	console.log(
		`✅ Successfully processed ${successCount} out of ${jsonData.resources.length} images`
	);
	await createMediaFromLightroomImages();
	await transferMediaToR2('%photos.adobe.io%');
	return successCount;
}

const main = async () => {
	try {
		await runIntegration('lightroom', syncLightroomImages);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncLightroomImages };
