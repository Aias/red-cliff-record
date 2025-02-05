import { eq, ilike } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	airtableAttachments,
	airtableCreators,
	airtableExtractConnections,
	airtableExtractCreators,
	airtableExtracts,
	airtableExtractSpaces,
	airtableSpaces,
	type AirtableAttachmentInsert,
	type AirtableCreatorInsert,
	type AirtableExtractConnectionInsert,
	type AirtableExtractCreatorInsert,
	type AirtableExtractInsert,
	type AirtableExtractSpaceInsert,
	type AirtableSpaceInsert,
} from '~/server/db/schema/airtable';
import { deleteMediaFromR2 } from '../common/media-helpers';
import { runIntegration } from '../common/run-integration';
import { syncAirtableEmbeddings } from './embeddings';
import { airtableBase, storeMedia } from './helpers';
import { CreatorFieldSetSchema, ExtractFieldSetSchema, SpaceFieldSetSchema } from './types';

const CHUNK_SIZE = 100;

async function cleanupExistingRecords() {
	console.log('Cleaning up existing Airtable records...');

	// First, get all attachments with R2 URLs that need to be deleted
	console.log(`Deleting attachments from R2 bucket.`);
	const attachmentsToDelete = await db.query.airtableAttachments.findMany({
		where: ilike(airtableAttachments.url, `%${process.env.ASSETS_DOMAIN}%`),
	});

	if (attachmentsToDelete.length > 0) {
		console.log(`Found ${attachmentsToDelete.length} R2 assets to delete`);

		// Process in batches of 50
		const BATCH_SIZE = 50;
		for (let i = 0; i < attachmentsToDelete.length; i += BATCH_SIZE) {
			const batch = attachmentsToDelete.slice(i, i + BATCH_SIZE);
			console.log(
				`Processing deletion batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(
					attachmentsToDelete.length / BATCH_SIZE
				)}`
			);

			await Promise.all(
				batch.map(async (attachment) => {
					try {
						// Extract the asset ID from the URL
						const url = new URL(attachment.url);
						const assetId = url.pathname.slice(1); // Remove leading slash
						await deleteMediaFromR2(assetId);
						console.log(`Deleted R2 asset: ${assetId}`);
					} catch (error) {
						console.error('Failed to delete R2 asset:', {
							attachmentId: attachment.id,
							url: attachment.url,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				})
			);

			// Add a small delay between batches to prevent rate limiting
			if (i + BATCH_SIZE < attachmentsToDelete.length) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	}

	// Then proceed with database cleanup in correct order to maintain referential integrity
	await db.transaction(async (tx) => {
		await tx.delete(airtableExtractConnections);
		await tx.delete(airtableExtractSpaces);
		await tx.delete(airtableExtractCreators);
		await tx.delete(airtableAttachments);
		await tx.delete(airtableExtracts);
		await tx.delete(airtableSpaces);
		await tx.delete(airtableCreators);
	});

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

const CLEAR_BEFORE_SYNC = false;

async function syncAirtableData(integrationRunId: number): Promise<number> {
	if (CLEAR_BEFORE_SYNC) {
		await cleanupExistingRecords();
	}

	await seedCreators(integrationRunId);
	await seedSpaces(integrationRunId);
	await seedExtracts(integrationRunId);
	await seedAttachments();
	await seedRelations();
	await syncAirtableEmbeddings();

	const count = await db.$count(
		airtableExtracts,
		eq(airtableExtracts.integrationRunId, integrationRunId)
	);

	const updatedMediaCount = await storeMedia();

	console.log(`Updated ${updatedMediaCount} media records`);

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
