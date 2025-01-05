import { eq } from 'drizzle-orm';
import { db, airtableBase } from '@/db/connections';
import { ExtractFieldSetSchema, CreatorFieldSetSchema, SpaceFieldSetSchema } from './types';
import {
	airtableExtracts,
	airtableAttachments,
	airtableCreators,
	airtableSpaces,
	airtableExtractCreators,
	airtableExtractSpaces,
	airtableExtractConnections,
	type AirtableCreatorInsert,
	type AirtableSpaceInsert,
	type AirtableExtractInsert,
	type AirtableAttachmentInsert,
	type AirtableExtractCreatorInsert,
	type AirtableExtractSpaceInsert,
	type AirtableExtractConnectionInsert,
} from '.';
import { runIntegration } from '../../operations/run-integration';

const CHUNK_SIZE = 100;

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
	const records = await airtableBase('Creators').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const creatorsToInsert: AirtableCreatorInsert[] = chunk.map((record) => {
			const fields = CreatorFieldSetSchema.parse(record.fields);
			return {
				id: record.id,
				name: fields.name,
				type: fields.type,
				primaryProject: fields.primaryProject,
				website: fields.site,
				professions: fields.professions,
				organizations: fields.organizations,
				nationalities: fields.nationality,
				contentCreatedAt: fields.createdTime,
				contentUpdatedAt: fields.lastUpdated,
				integrationRunId,
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
	const records = await airtableBase('Spaces').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const spacesToInsert: AirtableSpaceInsert[] = chunk.map((record) => {
			const fields = SpaceFieldSetSchema.parse(record.fields);
			return {
				id: record.id,
				name: fields.topic,
				fullName: fields.title,
				icon: fields.icon,
				description: fields.description,
				contentCreatedAt: fields.createdTime,
				contentUpdatedAt: fields.lastUpdated,
				integrationRunId,
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
	const records = await airtableBase('Extracts').select().all();

	for (let i = 0; i < records.length; i += CHUNK_SIZE) {
		const chunk = records.slice(i, i + CHUNK_SIZE);
		const extractsToInsert: AirtableExtractInsert[] = chunk.map((record) => {
			const fields = ExtractFieldSetSchema.parse(record.fields);
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
				publishedAt: fields.publishedOn,
				contentCreatedAt: fields.extractedOn,
				contentUpdatedAt: fields.lastUpdated,
				integrationRunId,
			};
		});

		await db.insert(airtableExtracts).values(extractsToInsert);
		console.log(
			`Inserted extracts chunk ${i / CHUNK_SIZE + 1} of ${Math.ceil(records.length / CHUNK_SIZE)}`
		);
	}

	// Second pass: Update parent references
	for (const record of records) {
		const fields = ExtractFieldSetSchema.parse(record.fields);
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
	const records = await airtableBase('Extracts').select().all();

	for (const record of records) {
		const fields = ExtractFieldSetSchema.parse(record.fields);
		const images = fields.images;
		if (!images) continue;

		for (let i = 0; i < images.length; i += CHUNK_SIZE) {
			const chunk = images.slice(i, i + CHUNK_SIZE);
			const attachmentsToInsert: AirtableAttachmentInsert[] = chunk.map((attachment) => ({
				id: attachment.id,
				url: attachment.url,
				filename: attachment.filename,
				size: attachment.size,
				width: attachment.width,
				height: attachment.height,
				type: attachment.type,
				extractId: record.id,
			}));

			await db.insert(airtableAttachments).values(attachmentsToInsert);
		}
	}
}

async function seedRelations() {
	console.log('Seeding relations...');
	const records = await airtableBase('Extracts').select().all();

	for (const record of records) {
		const fields = ExtractFieldSetSchema.parse(record.fields);

		// Insert creator relations
		if (fields.creatorIds?.length) {
			for (let i = 0; i < fields.creatorIds.length; i += CHUNK_SIZE) {
				const chunk = fields.creatorIds.slice(i, i + CHUNK_SIZE);
				const relations: AirtableExtractCreatorInsert[] = chunk.map((creatorId) => ({
					extractId: record.id,
					creatorId,
				}));
				await db.insert(airtableExtractCreators).values(relations);
			}
		}

		// Insert space relations
		if (fields.spaceIds?.length) {
			for (let i = 0; i < fields.spaceIds.length; i += CHUNK_SIZE) {
				const chunk = fields.spaceIds.slice(i, i + CHUNK_SIZE);
				const relations: AirtableExtractSpaceInsert[] = chunk.map((spaceId) => ({
					extractId: record.id,
					spaceId,
				}));
				await db.insert(airtableExtractSpaces).values(relations);
			}
		}

		// Insert connections
		if (fields.connectionIds?.length) {
			for (let i = 0; i < fields.connectionIds.length; i += CHUNK_SIZE) {
				const chunk = fields.connectionIds.slice(i, i + CHUNK_SIZE);
				const relations: AirtableExtractConnectionInsert[] = chunk.map((toExtractId) => ({
					fromExtractId: record.id,
					toExtractId,
				}));
				await db.insert(airtableExtractConnections).values(relations);
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

	const count = await db.$count(
		airtableExtracts,
		eq(airtableExtracts.integrationRunId, integrationRunId)
	);

	return count;
}

const main = async () => {
	try {
		await runIntegration('airtable', syncAirtableData);
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
