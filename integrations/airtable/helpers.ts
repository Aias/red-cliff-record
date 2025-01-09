import fs from 'fs/promises';
import path from 'path';
import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
} from '@aws-sdk/client-s3';
import Airtable from 'airtable';
import 'dotenv/config';
import type { z } from 'zod';
import {
	getContentTypeFromExtension,
	getExtensionFromContentType,
} from '@/app/lib/content-helpers';
import { AirtableAttachmentSchema } from './types';

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN,
});

export const airtableBase = Airtable.base(process.env.AIRTABLE_BASE_ID_BWB!);

type Attachment = z.infer<typeof AirtableAttachmentSchema>;

const s3Client = new S3Client({
	region: 'auto',
	endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
	},
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
		const finalExtension = fileExtension || getExtensionFromContentType(contentType) || '.jpg';
		const finalFilename = `${image.id}${finalExtension}`;
		const finalFilepath = path.join(process.cwd(), '.temp', finalFilename);

		const buffer = await response.arrayBuffer();
		await fs.writeFile(finalFilepath, new Uint8Array(buffer));
		console.log(`Downloaded: ${finalFilename}`);
	} catch (error) {
		console.error(`Error downloading ${filename}:`, error);
	}
}

export function getFileExtension(image: Attachment): string {
	// Try to get extension from original filename
	const fileExtension = path.extname(image.filename);
	if (fileExtension.length > 1) return fileExtension;

	// If no extension in filename, try to infer from type
	return getExtensionFromContentType(image.type) || '';
}

export async function uploadAttachment(tempDir: string, filename: string) {
	const filepath = path.join(tempDir, filename);

	try {
		// Check if the file already exists
		try {
			await s3Client.send(
				new HeadObjectCommand({
					Bucket: process.env.R2_BUCKET_NAME,
					Key: filename,
				})
			);
			console.log(`File ${filename} already exists. Skipping.`);
			return; // Skip this file
		} catch (error) {
			if (!(error instanceof S3ServiceException) || error.$metadata?.httpStatusCode !== 404) {
				// If it's not a 'Not Found' error, rethrow it
				throw error;
			}
			// If the file doesn't exist, continue with the upload
		}

		const fileContent = await fs.readFile(filepath);
		const contentType = getContentTypeFromExtension(path.extname(filename));

		const command = new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: filename,
			Body: fileContent,
			ContentType: contentType,
		});

		await s3Client.send(command);
		console.log(`Uploaded: ${filename}`);
	} catch (error) {
		console.error(`Error uploading ${filename}:`, error);
	}
}
