import {
  airtableAttachments,
  type AirtableAttachmentSelect,
  type AirtableExtractSelect,
} from '@hozo';
import Airtable from 'airtable';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { uploadMediaToR2 } from '@/server/lib/media';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { EnvSchemaBase } from '@/shared/lib/env';
import { createIntegrationLogger } from '../common/logging';
import { AirtableAttachmentSchema } from './types';

const logger = createIntegrationLogger('airtable', 'media');

const { AIRTABLE_ACCESS_TOKEN, AIRTABLE_BASE_ID, ASSETS_DOMAIN } = EnvSchemaBase.pick({
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

type ExtractImageField = ReturnType<typeof AirtableAttachmentSchema.parse>;
type ExtractImageCache = Map<string, Promise<ExtractImageField[]>>;

/**
 * Fetches the current `images` field for an extract from the Airtable API,
 * memoized per unique extract id so extracts with several attachments only
 * incur a single API call. A fresh fetch is required because the images are
 * signed Airtable URLs that expire, so the locally stored attachment row
 * can't be reused in place of it.
 */
function fetchExtractImages(
  extractId: string,
  cache: ExtractImageCache
): Promise<ExtractImageField[]> {
  let promise = cache.get(extractId);
  if (!promise) {
    promise = airtableBase('extracts')
      .find(extractId)
      .then((currentRecord) => AirtableAttachmentSchema.array().parse(currentRecord.get('images')));
    cache.set(extractId, promise);
  }
  return promise;
}

async function processAttachment(
  attachment: AttachmentWithExtract,
  extractImageCache: ExtractImageCache
) {
  try {
    const { id: extractId, title: extractTitle } = attachment.extract;
    const extractImages = await fetchExtractImages(extractId, extractImageCache);
    const image = extractImages.find((candidate) => candidate.id === attachment.id);

    if (!image) {
      logger.error('Attachment not found in extract images', undefined, {
        extractTitle,
        extractId,
        attachmentId: attachment.id,
      });
      return false;
    }

    const { id, url: airtableUrl, filename } = image;
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
        return false;
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
      return false;
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

  const extractImageCache: ExtractImageCache = new Map();

  const results = await runConcurrentPool({
    items: attachments,
    concurrency: 50,
    worker: (attachment) => processAttachment(attachment, extractImageCache),
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
