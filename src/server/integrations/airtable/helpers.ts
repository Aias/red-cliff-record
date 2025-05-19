import Airtable from 'airtable';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import type { AirtableAttachmentSelect, AirtableExtractSelect } from '@/server/db/schema/airtable';
import { airtableAttachments } from '@/server/db/schema/airtable';
import { requireEnv } from '../common/env';
import { AirtableAttachmentSchema } from './types';
import { uploadMediaToR2 } from '@/lib/server/media-helpers';

Airtable.configure({
	apiKey: requireEnv('AIRTABLE_ACCESS_TOKEN'),
});

export const airtableBase = Airtable.base(requireEnv('AIRTABLE_BASE_ID'));

type AttachmentWithExtract = AirtableAttachmentSelect & {
	extract: AirtableExtractSelect;
};

async function processAttachment(attachment: AttachmentWithExtract) {
	try {
		const { id: extractId, title: extractTitle } = attachment.extract;
		const currentRecord = await airtableBase('extracts').find(extractId);
		const attachments = AirtableAttachmentSchema.array().parse(currentRecord.get('images'));

		for (const attachment of attachments) {
			const { id, url: airtableUrl, filename } = attachment;
			console.log(`Processing ${filename} (${id})`);

			try {
				const r2Url = await uploadMediaToR2(airtableUrl);
				if (!r2Url) {
					console.error('Failed to upload attachment to R2:', {
						extractTitle,
						extractId,
						filename,
						attachmentId: id,
					});
					continue;
				}

				console.log(`Uploaded to R2: ${r2Url}`);

				const [updatedAttachment] = await db
					.update(airtableAttachments)
					.set({
						url: r2Url,
						recordUpdatedAt: new Date(),
					})
					.where(eq(airtableAttachments.id, attachment.id))
					.returning();

				if (!updatedAttachment) {
					console.error('Failed to update attachment in database:', {
						extractTitle,
						extractId,
						filename,
						attachmentId: id,
						r2Url,
					});
				}
			} catch (error) {
				console.error('Error processing attachment:', {
					extractTitle,
					extractId,
					filename,
					attachmentId: id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return true;
	} catch (error) {
		console.error('Error processing attachment:', {
			extractId: attachment.extract.id,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

async function processBatch(batch: AttachmentWithExtract[]) {
	const results = await Promise.all(batch.map(processAttachment));
	return results.filter(Boolean).length;
}

export async function storeMedia() {
	console.log('Starting media storage process...');

	const attachments = await db.query.airtableAttachments.findMany({
		with: {
			extract: true,
		},
		where: {
			url: {
				notIlike: `%${requireEnv('ASSETS_DOMAIN')}%`,
			},
		},
	});

	if (attachments.length === 0) {
		console.log('No attachments to process');
		return 0;
	}

	console.log(`Found ${attachments.length} attachments to process`);

	const BATCH_SIZE = 50;
	let successCount = 0;

	// Process in batches
	for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
		const batch = attachments.slice(i, i + BATCH_SIZE);
		console.log(
			`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(attachments.length / BATCH_SIZE)}`
		);

		const batchSuccesses = await processBatch(batch);
		successCount += batchSuccesses;

		console.log(`Completed batch with ${batchSuccesses} successes`);

		// Add a small delay between batches to prevent rate limiting
		if (i + BATCH_SIZE < attachments.length) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	console.log(`Successfully processed ${successCount} out of ${attachments.length} attachments`);
	return successCount;
}
