import Airtable, { type Attachment } from 'airtable';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { getExtensionFromContentType } from './helpers';

dotenv.config();

Airtable.configure({
	apiKey: process.env.VITE_AIRTABLE_ACCESS_TOKEN
});

const base = Airtable.base('appNAUPSEyCYlPtvG');
const BATCH_SIZE = 100;

async function downloadAttachments() {
	try {
		const extractsWithAttachments = await base('extracts')
			.select({
				fields: ['title', 'images'],
				filterByFormula: 'LEN(images) > 0'
			})
			.all();

		console.log(`Found ${extractsWithAttachments.length} extracts with attachments`);

		for (let i = 0; i < extractsWithAttachments.length; i += BATCH_SIZE) {
			const batch = extractsWithAttachments.slice(i, i + BATCH_SIZE);
			await Promise.all(batch.map(downloadAttachmentsForRecord));
			console.log(`Processed ${i + batch.length} extracts`);
		}

		console.log('All attachments downloaded successfully');
	} catch (error) {
		console.error('Error downloading attachments:', error);
	}
}

async function downloadAttachmentsForRecord(record: Airtable.Record<any>) {
	const images = record.get('images') as Attachment[] | undefined;
	if (!images || images.length === 0) return;

	for (const image of images) {
		await downloadAttachment(image);
	}
}

async function downloadAttachment(image: Attachment) {
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
		await fs.writeFile(finalFilepath, Buffer.from(buffer));
		console.log(`Downloaded: ${finalFilename}`);
	} catch (error) {
		console.error(`Error downloading ${filename}:`, error);
	}
}

function getFileExtension(image: Attachment): string {
	// Try to get extension from original filename
	const fileExtension = path.extname(image.filename);
	if (fileExtension.length > 1) return fileExtension;

	// If no extension in filename, try to infer from type
	return getExtensionFromContentType(image.type) || '';
}

downloadAttachments();
