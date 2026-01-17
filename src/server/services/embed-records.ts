import { records, RunType } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createRecordEmbeddingText, getRecordTitle } from '@/shared/lib/embedding';
import type { FullRecord } from '@/shared/types';
import { createEmbedding } from '../../app/lib/server/create-embedding';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';

const logger = createIntegrationLogger('services', 'embed-records');

export interface EmbedRecordResult {
  recordId: number;
  success: boolean;
  error?: string;
}

export interface EmbedRecordsByIdsOptions {
  /** Number of concurrent embedding requests (default: 10) */
  concurrency?: number;
}

/**
 * Embed specific records by their IDs.
 * Fetches full record data including relations and media, generates embedding text,
 * and updates the database with the new embeddings.
 */
export async function embedRecordsByIds(
  recordIds: number[],
  options: EmbedRecordsByIdsOptions = {}
): Promise<EmbedRecordResult[]> {
  const { concurrency = 10 } = options;

  if (recordIds.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(recordIds)];
  logger.info(`Embedding ${uniqueIds.length} record(s) by ID`);

  const recordsToEmbed: FullRecord[] = await db.query.records.findMany({
    where: { id: { in: uniqueIds } },
    with: {
      outgoingLinks: {
        with: {
          target: { columns: { textEmbedding: false } },
          predicate: true,
        },
      },
      incomingLinks: {
        with: {
          source: { columns: { textEmbedding: false } },
          predicate: true,
        },
        where: { predicate: { slug: { notIn: ['format_of'] } } },
      },
      media: true,
    },
  });

  const recordMap = new Map(recordsToEmbed.map((r) => [r.id, r]));

  const results = await runConcurrentPool({
    items: uniqueIds,
    concurrency,
    worker: async (recordId): Promise<EmbedRecordResult> => {
      const record = recordMap.get(recordId);
      if (!record) {
        return { recordId, success: false, error: 'Record not found' };
      }

      const textToEmbed = createRecordEmbeddingText(record);
      if (!textToEmbed) {
        logger.warn(`No text to embed for record ${recordId}, skipping`);
        return { recordId, success: false, error: 'No text to embed' };
      }

      try {
        const embedding = await createEmbedding(textToEmbed);
        await db.update(records).set({ textEmbedding: embedding }).where(eq(records.id, recordId));
        logger.info(`Embedded record ${recordId}: ${getRecordTitle(record, 80)}`);
        return { recordId, success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to embed record ${recordId}: ${message}`);
        return { recordId, success: false, error: message };
      }
    },
  });

  const successCount = results.filter((r) => r.ok && r.value.success).length;
  const failCount = results.filter((r) => !r.ok || !r.value.success).length;
  logger.info(`Embedded ${successCount} record(s), ${failCount} failed`);

  return results.map((r, i) => {
    if (r.ok) {
      return r.value;
    }
    const recordId = uniqueIds[i] ?? -1;
    return { recordId, success: false, error: r.error.message };
  });
}

/**
 * Embed a single record by ID. Convenience wrapper around embedRecordsByIds.
 */
export async function embedRecordById(recordId: number): Promise<EmbedRecordResult> {
  const [result] = await embedRecordsByIds([recordId]);
  return result ?? { recordId, success: false, error: 'Unknown error' };
}

/**
 * Embed all records that don't have embeddings yet.
 * Used by the sync integration to batch-process missing embeddings.
 */
export async function embedRecords(): Promise<number> {
  logger.start('Embedding records');

  const recordsWithoutEmbeddings = await db.query.records.findMany({
    where: { textEmbedding: { isNull: true } },
    columns: { id: true },
    orderBy: { recordUpdatedAt: 'desc' },
    limit: 5000,
  });

  logger.info(`Found ${recordsWithoutEmbeddings.length} records without embeddings`);

  if (recordsWithoutEmbeddings.length === 0) {
    logger.complete('No records to embed');
    return 0;
  }

  const results = await embedRecordsByIds(
    recordsWithoutEmbeddings.map((r) => r.id),
    { concurrency: 25 }
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  logger.complete(`Embedded ${successCount} records, ${failCount} failed`);

  return successCount;
}

export async function runEmbedRecordsIntegration() {
  await runIntegration('embeddings', embedRecords, RunType.enum.sync);
}

const main = async (): Promise<void> => {
  try {
    logger.start('Starting embedding for records');
    await runEmbedRecordsIntegration();
    logger.complete('Embedding for records completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error in embedding records', error);
    process.exit(1);
  }
};

if (import.meta.main) {
  void main();
}
