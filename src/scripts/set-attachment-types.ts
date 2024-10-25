import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { extensions } from './helpers';

const prisma = new PrismaClient();

async function setAttachmentTypes() {
	try {
		const tempDir = path.join(process.cwd(), '.temp');
		const files = await fs.readdir(tempDir);

		// Create a map to group attachment IDs by their file extension
		const extensionMap: { [key: string]: string[] } = {};

		for (const file of files) {
			const ext = path.extname(file).toLowerCase();
			if (ext in extensions) {
				const attachmentId = path.basename(file, ext);

				if (!extensionMap[ext]) {
					extensionMap[ext] = [];
				}
				extensionMap[ext].push(attachmentId);
			}
		}

		// Update the database in bulk for each extension
		for (const [ext, ids] of Object.entries(extensionMap)) {
			await prisma.attachment.updateMany({
				where: {
					id: { in: ids }
				},
				data: {
					extension: ext
				}
			});
			console.log(`Updated ${ids.length} attachments with extension ${ext}`);
		}

		console.log('All attachment types set successfully');
	} catch (error) {
		console.error('Error setting attachment types:', error);
	} finally {
		await prisma.$disconnect();
	}
}

setAttachmentTypes();
