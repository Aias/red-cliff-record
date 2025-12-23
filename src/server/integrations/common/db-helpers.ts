import { links as linksTable, type LinkInsert } from '@aias/hozo';
import { type Db } from '@/server/db/connections';
import type { PredicateSlug, RecordSlug } from '@/server/db/seed';
import { createIntegrationLogger } from './logging';

const predicateCache = new Map<PredicateSlug, number>();
const recordCache = new Map<RecordSlug, number>();

export async function getPredicateId(slug: PredicateSlug, db: Db): Promise<number> {
	if (predicateCache.has(slug)) return predicateCache.get(slug)!;

	const row = await db.query.predicates.findFirst({
		where: {
			slug: slug,
		},
	});

	if (!row) throw new Error(`Predicate slug ${slug} not found in DB`);
	predicateCache.set(slug, row.id);
	return row.id;
}

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
 * @param predicateSlug - The slug of the relation type
 * @returns A promise that resolves when the link is created
 */
export async function linkRecords(
	sourceId: number,
	targetId: number,
	predicateSlug: PredicateSlug,
	db: Db,
	options?: {
		/**
		 * Whether to emit a log line for this link operation.
		 * Default: true
		 */
		log?: boolean;
	}
): Promise<void> {
	const predicateId = await getPredicateId(predicateSlug, db);
	const shouldLog = options?.log ?? true;
	try {
		await db
			.insert(linksTable)
			.values({
				sourceId,
				targetId,
				predicateId,
			})
			.onConflictDoUpdate({
				target: [linksTable.sourceId, linksTable.targetId, linksTable.predicateId],
				set: {
					recordUpdatedAt: new Date(),
				},
			});

		if (shouldLog) {
			logger.info(
				`Linked record ${sourceId} to record ${targetId} with relation type ${predicateSlug} (${predicateId})`
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
			target: [linksTable.sourceId, linksTable.targetId, linksTable.predicateId],
			set: {
				recordUpdatedAt: new Date(),
			},
		});
}
