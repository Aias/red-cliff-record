import { PrismaClient } from '@prisma/client';
import Airtable, { type Attachment } from 'airtable';
import { generateOrderPrefix } from '../lib/order';
import { setAttachmentTypes } from './set-attachment-types';

const prisma = new PrismaClient();

Airtable.configure({
	apiKey: process.env.AIRTABLE_ACCESS_TOKEN
});

const base = Airtable.base('appNAUPSEyCYlPtvG');

const LARGE_BATCH_SIZE = 1000;
const MIGRATE_CREATORS = true;
const MIGRATE_SPACES = true;
const MIGRATE_EXTRACTS = true;

async function migrateCreators() {
	try {
		await prisma.creator.deleteMany({});
		console.log('Creator table cleared');

		const creators = await base('creators').select().all();
		const creatorData = creators.map((record) => ({
			id: record.id,
			name: record.get('name') as string,
			siteUrl: record.get('site') as string,
			createdAt: new Date(record.get('createdTime') as string),
			updatedAt: new Date(record.get('lastUpdated') as string)
		}));

		// Create creators
		for (let i = 0; i < creatorData.length; i += LARGE_BATCH_SIZE) {
			const batch = creatorData.slice(i, i + LARGE_BATCH_SIZE);
			await prisma.creator.createMany({
				data: batch
			});
			console.log(`Processed ${i + batch.length} creators`);
		}

		console.log('Creators migrated successfully');
	} catch (error) {
		console.error('Error migrating creators:', error);
	}
}

async function migrateSpaces() {
	try {
		await prisma.space.deleteMany({});
		console.log('Space table cleared');

		const spaces = await base('spaces').select().all();
		const spaceData = spaces.map((record) => ({
			id: record.id,
			topic: record.get('topic') as string,
			title: record.get('title') as string,
			icon: record.get('icon') as string,
			description: record.get('description') as string,
			createdAt: new Date(record.get('createdTime') as string),
			updatedAt: new Date(record.get('lastUpdated') as string)
		}));

		// Create spaces
		for (let i = 0; i < spaceData.length; i += LARGE_BATCH_SIZE) {
			const batch = spaceData.slice(i, i + LARGE_BATCH_SIZE);
			await prisma.space.createMany({
				data: batch
			});
			console.log(`Processed ${i + batch.length} spaces`);
		}

		console.log('Spaces migrated successfully');
	} catch (error) {
		console.error('Error migrating spaces:', error);
	}
}

async function migrateExtracts() {
	try {
		await prisma.extractRelation.deleteMany({});
		await prisma.extractFormat.deleteMany({});
		await prisma.attachment.deleteMany({});
		await prisma.extract.deleteMany({});
		console.log('Extract-related tables cleared');

		const extracts = await base('extracts').select().all();
		const uniqueFormats = new Set<string>();

		// Create a map of extracts for quick lookup
		const extractMap = new Map(extracts.map((record) => [record.id, record]));

		// Step 1: Prepare non-relational data
		const extractData = extracts.map((record) => {
			const format = record.get('format') as string;
			if (format) uniqueFormats.add(format);

			const parentId = (record.get('parent') as string[] | undefined)?.[0];
			let orderKey = 'a0'; // default value

			if (parentId) {
				const parentRecord = extractMap.get(parentId);
				if (parentRecord) {
					const childrenArray = parentRecord.get('children') as string[] | undefined;
					if (childrenArray) {
						const childIndex = childrenArray.indexOf(record.id);
						if (childIndex !== -1) {
							orderKey = generateOrderPrefix(childIndex) + '0';
						}
					}
				}
			}

			return {
				id: record.id,
				title: record.get('title') as string,
				content: record.get('extract') as string,
				notes: record.get('notes') as string,
				sourceUrl: record.get('source') as string,
				michelinStars: record.get('michelinStars') as number,
				createdAt: new Date(record.get('extractedOn') as string),
				updatedAt: new Date(record.get('lastUpdated') as string),
				publishedOn: record.get('published') ? new Date(record.get('publishedOn') as string) : null,
				orderKey: orderKey
			};
		});

		// Step 2: Create ExtractFormat records in batches
		const formatData = Array.from(uniqueFormats).map((format) => ({ name: format }));

		await Promise.all([
			// Create ExtractFormat records
			(async () => {
				for (let i = 0; i < formatData.length; i += LARGE_BATCH_SIZE) {
					const batch = formatData.slice(i, i + LARGE_BATCH_SIZE);
					await prisma.extractFormat.createMany({
						data: batch
					});
					console.log(`Processed ${i + batch.length} extract formats`);
				}
			})(),
			// Create Extract records
			(async () => {
				for (let i = 0; i < extractData.length; i += LARGE_BATCH_SIZE) {
					const batch = extractData.slice(i, i + LARGE_BATCH_SIZE);
					await prisma.extract.createMany({
						data: batch
					});
					console.log(`Processed ${i + batch.length} extracts`);
				}
			})()
		]);

		// Step 3: Create Attachment records
		console.log('Creating Attachment records...');
		const attachmentData = extracts.flatMap((record) => {
			const images = (record.get('images') as Attachment[] | undefined) || [];
			const imageCaption = record.get('imageCaption') as string | undefined;

			return images?.map((image) => ({
				id: image.id,
				caption: imageCaption,
				extractId: record.id
			}));
		});

		for (let i = 0; i < attachmentData.length; i += LARGE_BATCH_SIZE) {
			const batch = attachmentData.slice(i, i + LARGE_BATCH_SIZE);
			await prisma.attachment.createMany({
				data: batch
			});
			console.log(`Processed ${i + batch.length} attachments`);
		}

		// Step 4: Update links sequentially
		const formatMap = new Map((await prisma.extractFormat.findMany()).map((f) => [f.name, f.id]));

		for (const record of extracts) {
			const creators = record.get('creators') as string[] | undefined;
			const spaces = record.get('spaces') as string[] | undefined;
			const parent = record.get('parent') as string[] | undefined;
			const updateData = {
				where: { id: record.id },
				data: {
					formatId: record.get('format') ? formatMap.get(record.get('format') as string) : null,
					creators: {
						set: creators?.map((id) => ({ id })) || []
					},
					spaces: {
						set: spaces?.map((id) => ({ id })) || []
					},
					parentId: parent?.[0] || null
				}
			};

			await prisma.extract.update(updateData);
			console.log(`Updated links for ${record.get('title')}`);
		}

		// Step 5: Create ExtractRelation records
		const relationData = extracts.flatMap((record) =>
			((record.get('connections') as string[] | undefined) || []).map((connectionId) => ({
				fromId: record.id,
				toId: connectionId
			}))
		);

		for (let i = 0; i < relationData.length; i += LARGE_BATCH_SIZE) {
			const batch = relationData.slice(i, i + LARGE_BATCH_SIZE);
			await prisma.extractRelation.createMany({
				data: batch
			});
			console.log(`Processed ${i + batch.length} extract relations`);
		}

		console.log('Extract migration completed successfully');
	} catch (error) {
		console.error('Error during migration:', error);
	} finally {
		await prisma.$disconnect();
	}
}

async function migrateAll() {
	if (MIGRATE_CREATORS) await migrateCreators();
	if (MIGRATE_SPACES) await migrateSpaces();
	if (MIGRATE_EXTRACTS) await migrateExtracts();
	await setAttachmentTypes();
}

migrateAll();
