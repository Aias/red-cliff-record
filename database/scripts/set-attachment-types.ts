import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { extensions } from '../lib/extensions';

const prisma = new PrismaClient();

export async function setAttachmentTypes() {
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

		// Use a transaction to update extensions and URLs
		await prisma.$transaction(async (tx) => {
			// Update the database in bulk for each extension
			for (const [ext, ids] of Object.entries(extensionMap)) {
				await tx.attachment.updateMany({
					where: {
						id: { in: ids }
					},
					data: {
						extension: ext
					}
				});
				console.log(`Updated ${ids.length} attachments with extension ${ext}`);
			}

			// Update URLs for all attachments
			const attachments = await tx.attachment.findMany();
			for (const attachment of attachments) {
				await tx.attachment.update({
					where: { id: attachment.id },
					data: {
						url: `https://assets.barnsworthburning.net/${attachment.id}${attachment.extension}`
					}
				});
			}
			console.log('Updated URLs for all attachments');
		});

		console.log('All attachment types and URLs set successfully');
	} catch (error) {
		console.error('Error setting attachment types and URLs:', error);
	} finally {
		await prisma.$disconnect();
	}
}
