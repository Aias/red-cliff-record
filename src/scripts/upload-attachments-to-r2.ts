import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
	S3ServiceException
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const BATCH_SIZE = 100;

const s3Client = new S3Client({
	region: 'auto',
	endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID!,
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
	}
});

async function uploadAttachments() {
	try {
		const tempDir = path.join(process.cwd(), '.temp');
		const files = await fs.readdir(tempDir);

		console.log(`Found ${files.length} files to upload`);

		for (let i = 0; i < files.length; i += BATCH_SIZE) {
			const batch = files.slice(i, i + BATCH_SIZE);
			await Promise.all(batch.map((file) => uploadAttachment(tempDir, file)));
			console.log(`Processed ${i + batch.length} files`);
		}

		console.log('All attachments uploaded successfully');
	} catch (error) {
		console.error('Error uploading attachments:', error);
	}
}

async function uploadAttachment(tempDir: string, filename: string) {
	const filepath = path.join(tempDir, filename);

	try {
		// Check if the file already exists
		try {
			await s3Client.send(
				new HeadObjectCommand({
					Bucket: process.env.R2_BUCKET_NAME,
					Key: filename
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
			ContentType: contentType
		});

		await s3Client.send(command);
		console.log(`Uploaded: ${filename}`);
	} catch (error) {
		console.error(`Error uploading ${filename}:`, error);
	}
}

function getContentTypeFromExtension(extension: string): string {
	const extToMime: { [key: string]: string } = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml'
		// Add more extensions as needed
	};

	return extToMime[extension.toLowerCase()] || 'application/octet-stream';
}

uploadAttachments();
