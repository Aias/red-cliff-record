import { AwsClient } from 'aws4fetch';
import mime from 'mime-types';
import type { MediaInsert } from '@/server/db/schema';
import { getMimeTypeFromURL, getSmartMetadata } from './content-helpers';

/* ---------------------------------------------------------------------------
 * Environment variable validation
 * -------------------------------------------------------------------------*/
type EnvKey =
	| 'S3_REGION'
	| 'S3_ACCESS_KEY_ID'
	| 'S3_SECRET_ACCESS_KEY'
	| 'S3_BUCKET'
	| 'S3_ENDPOINT'
	| 'ASSETS_DOMAIN';

function getEnv(key: EnvKey): string {
	// Runtime access needs access to process.env or the Cloudflare env object
	// This assumes process.env is available during initialization or build
	// or that this runs in an environment where process.env is populated.
	const value = process.env[key];
	if (!value) console.warn(`Warning: ${key} environment variable is not set`);
	return value ?? '';
}

/* ---------------------------------------------------------------------------
 * AwsClient signer (works in Workers + Node18+)
 * -------------------------------------------------------------------------*/
const signer = new AwsClient({
	accessKeyId: getEnv('S3_ACCESS_KEY_ID'),
	secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY'),
	service: 's3',
	region: getEnv('S3_REGION') || 'auto', // R2 ignores the region
});

const BUCKET = getEnv('S3_BUCKET');
const ENDPOINT = getEnv('S3_ENDPOINT').replace(/\/$/, ''); // trim trailing slash
const PUBLIC_DOMAIN = getEnv('ASSETS_DOMAIN');

const r2ObjectURL = (key: string) => `${ENDPOINT}/${BUCKET}/${key}`;
const publicURL = (key: string) => `https://${PUBLIC_DOMAIN}/${key}`;

/* ---------------------------------------------------------------------------
 * Core helpers – PUT & DELETE
 * -------------------------------------------------------------------------*/
async function r2Put(key: string, body: BodyInit, contentType: string) {
	const res = await signer.fetch(r2ObjectURL(key), {
		method: 'PUT',
		body,
		headers: { 'content-type': contentType },
	});
	if (!res.ok) throw new Error(`R2 PUT failed: ${res.status} ${res.statusText}`);
}

async function r2Delete(key: string) {
	const res = await signer.fetch(r2ObjectURL(key), { method: 'DELETE' });
	// treat 404 as success (object already gone)
	if (!res.ok && res.status !== 404) {
		throw new Error(`R2 DELETE failed: ${res.status} ${res.statusText}`);
	}
}

/* ---------------------------------------------------------------------------
 * Public API – keeps the same surface as before
 * -------------------------------------------------------------------------*/

/**
 * Downloads a remote media file and uploads it to R2.
 */
export async function uploadMediaToR2(mediaUrl: string): Promise<string> {
	if (mediaUrl.includes(PUBLIC_DOMAIN)) {
		console.log(`Media URL already on R2: ${mediaUrl}`);
		return mediaUrl;
	}

	// 1 Download
	const resp = await fetch(mediaUrl);
	if (!resp.ok) {
		throw new Error(`Failed to download: HTTP ${resp.status} from ${mediaUrl}`);
	}
	const buffer = Buffer.from(await resp.arrayBuffer());

	// 2 Content‑type detection
	let contentType = resp.headers.get('content-type') ?? '';
	if (!contentType) contentType = getMimeTypeFromURL(mediaUrl);

	// 3 Key generation
	const key = `${crypto.randomUUID()}.${mime.extension(contentType) || 'bin'}`;

	// 4 PUT to R2
	await r2Put(key, buffer, contentType);
	console.log(`Successfully uploaded ${mediaUrl} → ${publicURL(key)}`);
	return publicURL(key);
}

/**
 * Uploads a file buffer received from the client to R2.
 */
export async function uploadClientFileToR2(
	fileBuffer: Buffer,
	contentType: string,
	originalFilename?: string
): Promise<string> {
	const key = (() => {
		let ext = mime.extension(contentType);
		if (!ext && originalFilename) {
			const originalExt = originalFilename.split('.').pop();
			if (originalExt) {
				const guessed = mime.lookup(originalExt);
				if (guessed && guessed.startsWith(contentType.split('/')[0]!)) ext = originalExt;
			}
		}
		return `${crypto.randomUUID()}.${ext || 'bin'}`;
	})();

	await r2Put(key, fileBuffer, contentType);
	console.log(`[uploadClientFileToR2] uploaded ${key}`);
	return publicURL(key);
}

/**
 * Deletes a media asset from R2.
 */
export async function deleteMediaFromR2(assetId: string): Promise<void> {
	await r2Delete(assetId);
	console.log(`Successfully deleted ${assetId} from R2 bucket ${BUCKET}`);
}

/**
 * Returns MediaInsert metadata for a given media URL plus record context.
 */
export async function getMediaInsertData(
	url: string,
	recordData: { recordId?: number | null; recordCreatedAt?: Date; recordUpdatedAt?: Date }
): Promise<MediaInsert | null> {
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(url);
		const { recordId, recordCreatedAt, recordUpdatedAt } = recordData;

		return {
			url,
			recordId,
			recordCreatedAt,
			recordUpdatedAt,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
		};
	} catch (err) {
		console.error('Error getting smart metadata for media', url, err);
		return null;
	}
}
