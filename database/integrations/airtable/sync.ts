import { base } from './queries';
import { createPgConnection } from '@schema/connections';
import type { ExtractFieldSet, CreatorFieldSet, SpaceFieldSet } from './types';
import {
	extracts,
	attachments,
	creators,
	spaces,
	extractCreators,
	extractSpaces,
	extractConnections,
} from '@schema/main/airtable';
import type {
	NewCreator,
	NewSpace,
	NewExtract,
	NewAttachment,
	NewExtractCreator,
	NewExtractSpace,
	NewExtractConnection,
} from '@schema/main/airtable';
import { IntegrationType } from '@schema/main/integrations';
import { eq } from 'drizzle-orm';
import { runIntegration } from '@utils/run-integration';

const CHUNK_SIZE = 100;
const db = createPgConnection();

async function cleanupExistingRecords() {
	console.log('Cleaning up existing Airtable records...');

	// Delete in correct order to maintain referential integrity
	await db.delete(extractConnections);
	await db.delete(extractSpaces);
	await db.delete(extractCreators);
	await db.delete(attachments);
	await db.delete(extracts);
	await db.delete(spaces);
	await db.delete(creators);

	console.log('Cleanup complete');
}

async function seedCreators(integrationRunId: number) {
	console.log('Seeding creators...');
	const records = await base('Creators').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const creatorsToInsert: NewCreator[] = chunk.map((record) => {
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
				integrationRunId,
			};
		});

		await db.insert(creators).values(creatorsToInsert);
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
		const spacesToInsert: NewSpace[] = chunk.map((record) => {
			const fields = record.fields as SpaceFieldSet;
			return {
				id: record.id,
				name: fields.topic,
				fullName: fields.title,
				icon: fields.icon,
				description: fields.description,
				createdAt: new Date(fields.createdTime),
				updatedAt: new Date(fields.lastUpdated),
				integrationRunId,
			};
		});

		await db.insert(spaces).values(spacesToInsert);
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
		const extractsToInsert: NewExtract[] = chunk.map((record) => {
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
				integrationRunId,
			};
		});

		await db.insert(extracts).values(extractsToInsert);
		console.log(
			`Inserted extracts chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(records.length / CHUNK_SIZE)}`
		);
	}

	// Second pass: Update parent references
	for (const record of records) {
		const fields = record.fields as ExtractFieldSet;
		if (fields.parentId?.[0]) {
			await db
				.update(extracts)
				.set({ parentId: fields.parentId[0] })
				.where(eq(extracts.id, record.id));
		}
	}
}

async function seedAttachments() {
	console.log('Seeding attachments...');
	const records = await base('Extracts').select().all();

	for (const record of records) {
		const fields = record.fields as ExtractFieldSet;
		const images = fields.images;
		if (!images) continue;

		for (let i = 0; i < images.length; i += CHUNK_SIZE) {
			const chunk = images.slice(i, i + CHUNK_SIZE);
			const attachmentsToInsert: NewAttachment[] = chunk.map((attachment) => ({
				id: attachment.id,
				url: attachment.url,
				filename: attachment.filename,
				size: attachment.size,
				width: (attachment as unknown as { width: number }).width,
				height: (attachment as unknown as { height: number }).height,
				type: attachment.type,
				extractId: record.id,
			}));

			await db.insert(attachments).values(attachmentsToInsert);
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
				const relations: NewExtractCreator[] = chunk.map((creatorId) => ({
					extractId: record.id,
					creatorId,
				}));
				await db.insert(extractCreators).values(relations);
			}
		}

		// Insert space relations
		if (fields.spaceIds?.length) {
			for (let i = 0; i < fields.spaceIds.length; i += CHUNK_SIZE) {
				const chunk = fields.spaceIds.slice(i, i + CHUNK_SIZE);
				const relations: NewExtractSpace[] = chunk.map((spaceId) => ({
					extractId: record.id,
					spaceId,
				}));
				await db.insert(extractSpaces).values(relations);
			}
		}

		// Insert connections
		if (fields.connectionIds?.length) {
			for (let i = 0; i < fields.connectionIds.length; i += CHUNK_SIZE) {
				const chunk = fields.connectionIds.slice(i, i + CHUNK_SIZE);
				const relations: NewExtractConnection[] = chunk.map((toExtractId) => ({
					fromExtractId: record.id,
					toExtractId,
				}));
				await db.insert(extractConnections).values(relations);
			}
		}
	}
}

async function syncAirtableData(integrationRunId: number): Promise<number> {
	await cleanupExistingRecords();

	await seedCreators(integrationRunId);
	await seedSpaces(integrationRunId);
	await seedExtracts(integrationRunId);
	await seedAttachments();
	await seedRelations();

	const count = await db.$count(extracts, eq(extracts.integrationRunId, integrationRunId));

	return count;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.enum.airtable, syncAirtableData);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncAirtableData };
