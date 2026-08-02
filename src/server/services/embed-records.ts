import { records, RunTypeSchema } from '@hozo';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/connections/postgres';
import { createEmbeddings } from '@/server/lib/create-embedding';
import { runConcurrentPool } from '@/shared/lib/async-pool';
import { createRecordEmbeddingText, getRecordTitle } from '@/shared/lib/embedding';
import type { FullRecord } from '@/shared/types/domain';
import { createIntegrationLogger } from '../integrations/common/logging';
import { runIntegration } from '../integrations/common/run-integration';

const logger = createIntegrationLogger('services', 'embed-records');

/** Records embedded (and written back) per OpenAI request. */
const EMBED_BATCH_SIZE = 64;

/** Number of embedding batches processed concurrently. */
const EMBED_CONCURRENCY = 4;

export interface EmbedRecordResult {
  recordId: number;
  success: boolean;
  error?: string;
}

/**
 * Embed specific records by their IDs.
 * Fetches full record data including relations and media, generates embedding text,
 * and updates the database with the new embeddings. Texts are sent to the
 * embedding API in batches rather than one request per record.
 */
export async function embedRecordsByIds(recordIds: number[]): Promise<EmbedRecordResult[]> {
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
          target: { columns: { textEmbedding: false, textSearch: false } },
        },
      },
      incomingLinks: {
        with: {
          source: { columns: { textEmbedding: false, textSearch: false } },
        },
        where: { predicate: { notIn: ['format_of'] } },
      },
      media: true,
    },
  });

  const recordMap = new Map(recordsToEmbed.map((r) => [r.id, r]));
  const resultMap = new Map<number, EmbedRecordResult>();
  const pending: { recordId: number; record: FullRecord; text: string }[] = [];

  for (const recordId of uniqueIds) {
    const record = recordMap.get(recordId);
    if (!record) {
      resultMap.set(recordId, { recordId, success: false, error: 'Record not found' });
      continue;
    }

    const text = createRecordEmbeddingText(record);
    if (!text) {
      logger.warn(`No text to embed for record ${recordId}, skipping`);
      resultMap.set(recordId, { recordId, success: false, error: 'No text to embed' });
      continue;
    }

    pending.push({ recordId, record, text });
  }

  const batches: { start: number; items: typeof pending }[] = [];
  for (let start = 0; start < pending.length; start += EMBED_BATCH_SIZE) {
    batches.push({ start, items: pending.slice(start, start + EMBED_BATCH_SIZE) });
  }

  await runConcurrentPool({
    items: batches,
    concurrency: EMBED_CONCURRENCY,
    async worker({ start, items: batch }) {
      try {
        const embeddings = await createEmbeddings(batch.map((item) => item.text));

        await Promise.all(
          batch.map(async (item, index) => {
            const embedding = embeddings[index];
            if (!embedding) {
              resultMap.set(item.recordId, {
                recordId: item.recordId,
                success: false,
                error: 'Missing embedding in batch response',
              });
              return;
            }

            await db
              .update(records)
              .set({ textEmbedding: embedding })
              .where(eq(records.id, item.recordId));
            resultMap.set(item.recordId, { recordId: item.recordId, success: true });
          })
        );

        const last = batch.at(-1);
        if (batch.length === 1 && last) {
          logger.info(`Embedded record ${last.recordId}: ${getRecordTitle(last.record, 80)}`);
        } else {
          logger.info(`Embedded records ${start + 1}–${start + batch.length} of ${pending.length}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to embed batch of ${batch.length} record(s): ${message}`);
        for (const item of batch) {
          resultMap.set(item.recordId, { recordId: item.recordId, success: false, error: message });
        }
      }
    },
  });

  const results = uniqueIds.map(
    (recordId) => resultMap.get(recordId) ?? { recordId, success: false, error: 'Unknown error' }
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;
  logger.info(`Embedded ${successCount} record(s), ${failCount} failed`);

  return results;
}

/**
 * Embed a single record by ID. Convenience wrapper around embedRecordsByIds.
 */
export async function embedRecordById(recordId: number): Promise<EmbedRecordResult> {
  const [result] = await embedRecordsByIds([recordId]);
  return result ?? { recordId, success: false, error: 'Unknown error' };
}

/** Settle window before regenerating, so rapid edits (keystroke-level saves)
 * coalesce into one embedding request per burst instead of one per mutation. */
const EMBED_SETTLE_MS = 2500;

const pendingEmbedIds = new Set<number>();
let embedSettleTimer: ReturnType<typeof setTimeout> | undefined;

function flushQueuedEmbeddings(): void {
  const ids = [...pendingEmbedIds];
  pendingEmbedIds.clear();
  embedSettleTimer = undefined;

  void embedRecordsByIds(ids)
    .then(async (results) => {
      const failedIds = results.filter((r) => !r.success).map((r) => r.recordId);
      if (failedIds.length > 0) {
        await db.update(records).set({ textEmbedding: null }).where(inArray(records.id, failedIds));
      }
    })
    .catch((error) => {
      logger.error(`Failed to regenerate embeddings for ${ids.length} record(s)`, error);
    });
}

/**
 * Regenerate embeddings for records whose embedding text changed, without
 * blocking the mutation that changed it. Regeneration waits until edits
 * settle ({@link EMBED_SETTLE_MS} after the most recent call), then runs one
 * batch. Records whose regeneration fails have their vectors nulled so the
 * enrichment sync retries them instead of serving stale ones indefinitely.
 */
export function queueRecordEmbeddings(recordIds: number[]): void {
  if (recordIds.length === 0) {
    return;
  }
  for (const id of recordIds) {
    pendingEmbedIds.add(id);
  }
  clearTimeout(embedSettleTimer);
  embedSettleTimer = setTimeout(flushQueuedEmbeddings, EMBED_SETTLE_MS);
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

  const results = await embedRecordsByIds(recordsWithoutEmbeddings.map((r) => r.id));

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  logger.complete(`Embedded ${successCount} records, ${failCount} failed`);

  return successCount;
}

export async function runEmbedRecordsIntegration() {
  await runIntegration('embeddings', embedRecords, RunTypeSchema.enum.sync);
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
