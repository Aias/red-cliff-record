import { createPgConnection } from '@schema/connections';
import { photographs } from '@schema/main/adobe';
import { IntegrationType, RunType } from '@schema/main/integrations';
import { runIntegration } from '@utils/run-integration';
import type { LightroomJsonResponse } from './types';

const db = createPgConnection();

const ALBUM_URL =
	'https://lightroom.adobe.com/v2/spaces/f89a3c5060d8467a952c66de97edbe39/albums/f1edd4179e2f4e1d802f8a94f40b542c/assets?embed=asset%3Buser&order_after=-&exclude=incomplete&subtype=image';

async function syncLightroomImages(integrationRunId: number) {
	console.log('📷 Fetching Lightroom album data...');
	const response = await fetch(ALBUM_URL, {
		headers: {
			Authorization: `Bearer ${process.env.ADOBE_API_TOKEN}`
		}
	});

	if (!response.ok) {
		throw new Error(`Lightroom API request failed with status ${response.status}`);
	}

	const textData = await response.text();
	const jsonData = JSON.parse(
		textData.replace(/^while\s*\(1\)\s*{\s*}\s*/, '')
	) as LightroomJsonResponse;

	console.log(`✅ Retrieved ${jsonData.resources.length} resources from Lightroom`);

	const baseUrl = jsonData.base;

	let successCount = 0;
	for (const resource of jsonData.resources) {
		const asset = resource.asset;
		const payload = asset.payload;
		const { importSource, autoTags, develop, xmp, location, aesthetics, captureDate, userUpdated } =
			payload;
		const renditionUrl = `${baseUrl}${asset.links['/rels/rendition_type/2048'].href}`;

		const imageToInsert: typeof photographs.$inferInsert = {
			id: asset.id,
			url: renditionUrl,
			fileName: importSource.fileName,
			contentType: importSource.contentType,
			sourceDevice: develop.device,
			cameraMake: xmp.tiff.Make,
			cameraModel: xmp.tiff.Model,
			cameraLens: xmp.aux.Lens,
			captureDate: new Date(captureDate),
			userUpdatedDate: new Date(userUpdated),
			fileSize: importSource.fileSize,
			croppedWidth: develop.croppedWidth,
			croppedHeight: develop.croppedHeight,
			aesthetics: aesthetics,
			exif: xmp.exif,
			location: location,
			autoTags: Object.keys(autoTags.tags),
			integrationRunId: integrationRunId
		};

		try {
			await db.insert(photographs).values(imageToInsert).onConflictDoUpdate({
				target: photographs.id,
				set: imageToInsert
			});
			successCount++;
		} catch (error) {
			console.error('Error processing image:', {
				image: imageToInsert,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	console.log(
		`✅ Successfully processed ${successCount} out of ${jsonData.resources.length} images`
	);
	return successCount;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.LIGHTROOM, syncLightroomImages, RunType.INCREMENTAL);
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
