import path from 'path';
import Airtable from 'airtable';
import { S3Client } from 'bun';
import 'dotenv/config';
import mime from 'mime-types';
import type { z } from 'zod';
import { AirtableAttachmentSchema } from './types';

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN,
});

export const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID_BWB!);

const TEMP_DIR = path.join(process.cwd(), '.temp');

type Attachment = z.infer<typeof AirtableAttachmentSchema>;

// Create S3 client
const s3 = new S3Client({
	region: process.env.S3_REGION!,
	accessKeyId: process.env.S3_ACCESS_KEY_ID!,
	secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	bucket: process.env.S3_BUCKET!,
	endpoint: process.env.S3_ENDPOINT!,
});

export async function getAttachmentsForRecord(recordId: string): Promise<Attachment[]> {
	try {
		const record = await airtableBase('extracts').find(recordId);
		const images = AirtableAttachmentSchema.array().parse(record.get('images'));
		return images || [];
	} catch (error) {
		console.error(`Error fetching attachments for record ${recordId}:`, error);
		return [];
	}
}

export async function downloadAttachmentsForRecord(images: Attachment[]) {
	if (!images || images.length === 0) return;

	for (const image of images) {
		await downloadAttachment(image);
	}
}

export async function downloadAttachment(image: Attachment) {
	const url = image.url;
	const fileExtension = getFileExtension(image);
	const filename = `${image.id}${fileExtension}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to download ${url}: ${response.status}`);
		}

		const contentType = response.headers.get('Content-Type');
		// Use mime-types to get extension, fallback to original extension or .jpg
		const finalExtension =
			mime.extension(contentType || '') || path.extname(image.filename) || '.jpg';
		const finalFilename = `${image.id}.${finalExtension}`;
		const finalFilepath = path.join(TEMP_DIR, finalFilename);

		await Bun.write(finalFilepath, response);
		console.log(`Downloaded: ${finalFilename}`);
	} catch (error) {
		console.error(`Error downloading ${filename}:`, error);
	}
}

function getFileExtension(image: Attachment): string {
	// Try to get extension from original filename
	const fileExtension = path.extname(image.filename);
	if (fileExtension.length > 1) return fileExtension;

	// Use mime-types to get extension from content type, fallback to .jpg
	return `.${mime.extension(image.type) || 'jpg'}`;
}

export async function uploadAttachment(filename: string) {
	const filepath = path.join(TEMP_DIR, filename);

	try {
		// Check if the file already exists in S3
		const exists = await s3.exists(filename);
		if (exists) {
			console.log(`File ${filename} already exists. Skipping.`);
			return;
		}

		// Create file reference
		const file = Bun.file(filepath);

		// Use mime.lookup to get content type from filename
		const contentType = mime.lookup(filename) || 'application/octet-stream';

		// Upload to S3 with content type
		await s3.write(filename, file, {
			type: contentType,
		});

		console.log(`Uploaded: ${filename}`);
	} catch (error) {
		console.error(`Error uploading ${filename}:`, error);
	}
}
