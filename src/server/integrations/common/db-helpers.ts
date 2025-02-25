import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { recordCreators, recordRelations, records } from '@/server/db/schema';
import type {
	ChildType,
	CreatorRole,
	RecordCreatorInsert,
	RecordRelationInsert,
	RecordRelationType,
} from '@/server/db/schema';
import { createIntegrationLogger } from './logging';

const logger = createIntegrationLogger('common', 'db-helpers');

/**
 * Links a record to a creator record
 *
 * @param recordId - The ID of the record to link
 * @param creatorId - The ID of the creator record
 * @param role - The role of the creator (defaults to 'creator')
 * @returns A promise that resolves when the link is created
 */
export async function linkRecordToCreator(
	recordId: number,
	creatorId: number,
	role: CreatorRole = 'creator'
): Promise<void> {
	try {
		await db
			.insert(recordCreators)
			.values({
				recordId,
				creatorId,
				creatorRole: role,
			})
			.onConflictDoUpdate({
				target: [recordCreators.recordId, recordCreators.creatorId, recordCreators.creatorRole],
				set: {
					recordUpdatedAt: new Date(),
				},
			});

		logger.info(`Linked record ${recordId} to creator ${creatorId} with role ${role}`);
	} catch (error) {
		logger.error(`Failed to link record ${recordId} to creator ${creatorId}`, error);
		throw error;
	}
}

/**
 * Links a record to a target record with a specific relation type
 *
 * @param sourceId - The ID of the source record
 * @param targetId - The ID of the target record
 * @param type - The type of relation (defaults to 'related_to')
 * @returns A promise that resolves when the link is created
 */
export async function linkRecords(
	sourceId: number,
	targetId: number,
	type: RecordRelationType = 'related_to'
): Promise<void> {
	try {
		await db
			.insert(recordRelations)
			.values({
				sourceId,
				targetId,
				type,
			})
			.onConflictDoUpdate({
				target: [recordRelations.sourceId, recordRelations.targetId, recordRelations.type],
				set: {
					recordUpdatedAt: new Date(),
				},
			});

		logger.info(`Linked record ${sourceId} to record ${targetId} with relation type ${type}`);
	} catch (error) {
		logger.error(`Failed to link record ${sourceId} to record ${targetId}`, error);
		throw error;
	}
}

/**
 * Updates a record's parent relationship
 *
 * @param recordId - The ID of the child record
 * @param parentId - The ID of the parent record
 * @param childType - The type of child relationship (defaults to 'part_of')
 * @returns A promise that resolves when the relationship is updated
 */
export async function setRecordParent(
	recordId: number,
	parentId: number,
	childType: ChildType = 'part_of'
): Promise<void> {
	try {
		await db.update(records).set({ parentId, childType }).where(eq(records.id, recordId));

		logger.info(`Set parent of record ${recordId} to ${parentId} with type ${childType}`);
	} catch (error) {
		logger.error(`Failed to set parent of record ${recordId} to ${parentId}`, error);
		throw error;
	}
}

/**
 * Bulk inserts record creator relationships
 *
 * @param items - Array of record creator relationships to insert
 * @returns A promise that resolves when all relationships are inserted
 */
export async function bulkInsertRecordCreators(items: RecordCreatorInsert[]): Promise<void> {
	if (items.length === 0) return;

	try {
		await db
			.insert(recordCreators)
			.values(items)
			.onConflictDoUpdate({
				target: [recordCreators.recordId, recordCreators.creatorId, recordCreators.creatorRole],
				set: {
					recordUpdatedAt: new Date(),
				},
			});

		logger.info(`Inserted ${items.length} record creator relationships`);
	} catch (error) {
		logger.error(`Failed to insert ${items.length} record creator relationships`, error);
		throw error;
	}
}

/**
 * Bulk inserts record relation relationships
 *
 * @param items - Array of record relation relationships to insert
 * @returns A promise that resolves when all relationships are inserted
 */
export async function bulkInsertRecordRelations(items: RecordRelationInsert[]): Promise<void> {
	if (items.length === 0) return;

	try {
		await db
			.insert(recordRelations)
			.values(items)
			.onConflictDoUpdate({
				target: [recordRelations.sourceId, recordRelations.targetId, recordRelations.type],
				set: {
					recordUpdatedAt: new Date(),
				},
			});

		logger.info(`Inserted ${items.length} record relation relationships`);
	} catch (error) {
		logger.error(`Failed to insert ${items.length} record relation relationships`, error);
		throw error;
	}
}
