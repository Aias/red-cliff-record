import { links as linksTable, type LinkInsert, type PredicateSlug } from '@hozo';
import { type Db } from '@/server/db/connections/postgres';
import type { RecordSlug } from '@/server/db/seed';
import { createIntegrationLogger } from './logging';

const recordCache = new Map<RecordSlug, number>();

export async function getRecordId(slug: RecordSlug, db: Db): Promise<number> {
  if (recordCache.has(slug)) return recordCache.get(slug)!;

  const row = await db.query.records.findFirst({
    where: {
      slug: slug,
    },
  });

  if (!row) throw new Error(`Record slug ${slug} not found in DB`);
  recordCache.set(slug, row.id);
  return row.id;
}

const logger = createIntegrationLogger('common', 'db-helpers');

/**
 * Links a record to a target record with a specific relation type
 *
 * @param sourceId - The ID of the source record
 * @param targetId - The ID of the target record
 * @param predicate - The predicate slug identifying the relation type
 * @returns A promise that resolves when the link is created
 */
export async function linkRecords(
  sourceId: number,
  targetId: number,
  predicate: PredicateSlug,
  db: Db,
  options?: {
    /**
     * Whether to emit a log line for this link operation.
     * Default: true
     */
    log?: boolean;
  }
): Promise<void> {
  const shouldLog = options?.log ?? true;
  try {
    await db
      .insert(linksTable)
      .values({
        sourceId,
        targetId,
        predicate,
      })
      .onConflictDoUpdate({
        target: [linksTable.sourceId, linksTable.targetId, linksTable.predicate],
        set: {
          recordUpdatedAt: new Date(),
        },
      });

    if (shouldLog) {
      logger.info(
        `Linked record ${sourceId} to record ${targetId} with relation type ${predicate}`
      );
    }
  } catch (error) {
    logger.error(`Failed to link record ${sourceId} to record ${targetId}`, error);
    throw error;
  }
}

export async function bulkInsertLinks(links: LinkInsert[], db: Db): Promise<void> {
  await db
    .insert(linksTable)
    .values(links)
    .onConflictDoUpdate({
      target: [linksTable.sourceId, linksTable.targetId, linksTable.predicate],
      set: {
        recordUpdatedAt: new Date(),
      },
    });
}
