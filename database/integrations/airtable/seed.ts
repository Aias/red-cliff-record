import { base } from './queries';
import { createPgConnection } from '@schema/connections';
import type { ExtractFieldSet, CreatorFieldSet, SpaceFieldSet } from './types';
import {
	airtableExtracts,
	airtableAttachments,
	airtableCreators,
	airtableSpaces,
	airtableExtractCreators,
	airtableExtractSpaces,
	airtableExtractConnections
} from '@schema/main';
import { IntegrationType } from '@schema/main/integrations';
import { eq } from 'drizzle-orm';
import { runIntegration } from '@utils/run-integration';

const CHUNK_SIZE = 100;
const db = createPgConnection();

async function cleanupExistingRecords() {
	console.log('Cleaning up existing Airtable records...');

	// Delete in correct order to maintain referential integrity
	await db.delete(airtableExtractConnections);
	await db.delete(airtableExtractSpaces);
	await db.delete(airtableExtractCreators);
	await db.delete(airtableAttachments);
	await db.delete(airtableExtracts);
	await db.delete(airtableSpaces);
	await db.delete(airtableCreators);

	console.log('Cleanup complete');
}

async function seedCreators(integrationRunId: number) {
	console.log('Seeding creators...');
	const records = await base('Creators').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const creatorsToInsert: (typeof airtableCreators.$inferInsert)[] = chunk.map((record) => {
			const fields = record.fields as CreatorFieldSet;
			return {
				id: record.id,
				name: fields.name,
				type: fields.type,
				primaryProject: fields.primaryProject,
				website: fields.site,
				professions: fields.professions,
				organizations: fields.organizations,
				nationalities: fields.nationality,
				createdAt: new Date(fields.createdTime),
				updatedAt: new Date(fields.lastUpdated),
				integrationRunId
			};
		});

		await db.insert(airtableCreators).values(creatorsToInsert);
		console.log(
			`Inserted creators chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(records.length / CHUNK_SIZE)}`
		);
	}
}

async function seedSpaces(integrationRunId: number) {
	console.log('Seeding spaces...');
	const records = await base('Spaces').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const spacesToInsert: (typeof airtableSpaces.$inferInsert)[] = chunk.map((record) => {
			const fields = record.fields as SpaceFieldSet;
			return {
				id: record.id,
				name: fields.topic,
				fullName: fields.title,
				icon: fields.icon,
				description: fields.description,
				createdAt: new Date(fields.createdTime),
				updatedAt: new Date(fields.lastUpdated),
				integrationRunId
			};
		});

		await db.insert(airtableSpaces).values(spacesToInsert);
		console.log(
			`Inserted spaces chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(records.length / CHUNK_SIZE)}`
		);
	}
}

async function seedExtracts(integrationRunId: number) {
	console.log('Seeding extracts...');
	const records = await base('Extracts').select().all();

	// First pass: Create all extracts without parent references
	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const extractsToInsert: (typeof airtableExtracts.$inferInsert)[] = chunk.map((record) => {
			const fields = record.fields as ExtractFieldSet;
			return {
				id: record.id,
				title: fields.title,
				format: fields.format,
				source: fields.source,
				michelinStars: fields.michelinStars,
				content: fields.extract,
				notes: fields.notes,
				attachmentCaption: fields.imageCaption,
				parentId: null,
				lexicographicalOrder: 'a0',
				createdAt: new Date(fields.extractedOn),
				updatedAt: new Date(fields.lastUpdated),
				publishedAt: fields.publishedOn ? new Date(fields.publishedOn) : null,
				integrationRunId
			};
		});

		await db.insert(airtableExtracts).values(extractsToInsert);
		console.log(
			`Inserted extracts chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(records.length / CHUNK_SIZE)}`
		);
	}

	// Second pass: Update parent references
	for (const record of records) {
		const fields = record.fields as ExtractFieldSet;
		if (fields.parentId?.[0]) {
			await db
				.update(airtableExtracts)
				.set({ parentId: fields.parentId[0] })
				.where(eq(airtableExtracts.id, record.id));
		}
	}
}

async function seedAttachments() {
	console.log('Seeding attachments...');
	const records = await base('Extracts').select().all();

	for (const record of records) {
		const fields = record.fields as ExtractFieldSet;
		const attachments = fields.images;
		if (!attachments) continue;

		for (let i = 0; i < attachments.length; i += CHUNK_SIZE) {
			const chunk = attachments.slice(i, i + CHUNK_SIZE);
			const attachmentsToInsert: (typeof airtableAttachments.$inferInsert)[] = chunk.map(
				(attachment) => ({
					id: attachment.id,
					url: attachment.url,
					filename: attachment.filename,
					size: attachment.size,
					width: (attachment as unknown as { width: number }).width,
					height: (attachment as unknown as { height: number }).height,
					type: attachment.type,
					extractId: record.id
				})
			);

			await db.insert(airtableAttachments).values(attachmentsToInsert);
		}
	}
}

async function seedRelations() {
	console.log('Seeding relations...');
	const records = await base('Extracts').select().all();

	for (const record of records) {
		const fields = record.fields as ExtractFieldSet;

		// Insert creator relations
		if (fields.creatorIds?.length) {
			for (let i = 0; i < fields.creatorIds.length; i += CHUNK_SIZE) {
				const chunk = fields.creatorIds.slice(i, i + CHUNK_SIZE);
				const relations: (typeof airtableExtractCreators.$inferInsert)[] = chunk.map(
					(creatorId) => ({
						extractId: record.id,
						creatorId
					})
				);
				await db.insert(airtableExtractCreators).values(relations);
			}
		}

		// Insert space relations
		if (fields.spaceIds?.length) {
			for (let i = 0; i < fields.spaceIds.length; i += CHUNK_SIZE) {
				const chunk = fields.spaceIds.slice(i, i + CHUNK_SIZE);
				const relations: (typeof airtableExtractSpaces.$inferInsert)[] = chunk.map((spaceId) => ({
					extractId: record.id,
					spaceId
				}));
				await db.insert(airtableExtractSpaces).values(relations);
			}
		}

		// Insert connections
		if (fields.connectionIds?.length) {
			for (let i = 0; i < fields.connectionIds.length; i += CHUNK_SIZE) {
				const chunk = fields.connectionIds.slice(i, i + CHUNK_SIZE);
				const relations: (typeof airtableExtractConnections.$inferInsert)[] = chunk.map(
					(toExtractId) => ({
						fromExtractId: record.id,
						toExtractId
					})
				);
				await db.insert(airtableExtractConnections).values(relations);
			}
		}
	}
}

async function processAirtableData(integrationRunId: number): Promise<number> {
	await cleanupExistingRecords();

	await seedCreators(integrationRunId);
	await seedSpaces(integrationRunId);
	await seedExtracts(integrationRunId);
	await seedAttachments();
	await seedRelations();

	// Use $count utility instead of raw SQL
	const count = await db.$count(
		airtableExtracts,
		eq(airtableExtracts.integrationRunId, integrationRunId)
	);

	return count;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.AIRTABLE, processAirtableData);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed.ts')) {
	main();
}

export { main as seedAirtableData };
