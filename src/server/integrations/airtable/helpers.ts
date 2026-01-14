import {
	airtableAttachments,
	type AirtableAttachmentSelect,
	type AirtableExtractSelect,
} from '@aias/hozo';
import Airtable from 'airtable';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { uploadMediaToR2 } from '@/server/lib/media';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { EnvSchema } from '@/shared/lib/env';
import { createIntegrationLogger } from '../common/logging';
import { AirtableAttachmentSchema } from './types';

const logger = createIntegrationLogger('airtable', 'media');

const { AIRTABLE_ACCESS_TOKEN, AIRTABLE_BASE_ID, ASSETS_DOMAIN } = EnvSchema.pick({
	AIRTABLE_ACCESS_TOKEN: true,
	AIRTABLE_BASE_ID: true,
	ASSETS_DOMAIN: true,
}).parse(process.env);

Airtable.configure({
	apiKey: AIRTABLE_ACCESS_TOKEN,
});

export const airtableBase = Airtable.base(AIRTABLE_BASE_ID);

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
			logger.info(`Processing ${filename} (${id})`);

			try {
				const r2Url = await uploadMediaToR2(airtableUrl);
				if (!r2Url) {
					logger.error('Failed to upload attachment to R2', undefined, {
						extractTitle,
						extractId,
						filename,
						attachmentId: id,
					});
					continue;
				}

				logger.info(`Uploaded to R2: ${r2Url}`);

				const [updatedAttachment] = await db
					.update(airtableAttachments)
					.set({
						url: r2Url,
						recordUpdatedAt: new Date(),
					})
					.where(eq(airtableAttachments.id, attachment.id))
					.returning();

				if (!updatedAttachment) {
					logger.error('Failed to update attachment in database', undefined, {
						extractTitle,
						extractId,
						filename,
						attachmentId: id,
						r2Url,
					});
				}
			} catch (error) {
				logger.error('Error processing attachment', error, {
					extractTitle,
					extractId,
					filename,
					attachmentId: id,
				});
			}
		}

		return true;
	} catch (error) {
		logger.error('Error processing attachment', error, { extractId: attachment.extract.id });
		return false;
	}
}

export async function storeMedia() {
	logger.start('Starting media storage process');

	const attachments = await db.query.airtableAttachments.findMany({
		with: {
			extract: true,
		},
		where: {
			url: {
				notIlike: `%${ASSETS_DOMAIN}%`,
			},
		},
	});

	if (attachments.length === 0) {
		logger.skip('No attachments to process');
		return 0;
	}

	logger.info(`Found ${attachments.length} attachments to process`);

	const results = await runConcurrentPool({
		items: attachments,
		concurrency: 50,
		worker: processAttachment,
		onProgress: (completed, total) => {
			if (completed % 10 === 0 || completed === total) {
				logger.info(`Progress: ${completed}/${total} attachments processed`);
			}
		},
	});

	const successCount = results.filter((r) => r.ok && r.value).length;
	logger.complete(`Successfully processed ${successCount} of ${attachments.length} attachments`);
	return successCount;
}
