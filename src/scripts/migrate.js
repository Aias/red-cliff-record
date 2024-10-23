import { PrismaClient } from '@prisma/client';
import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

Airtable.configure({
	apiKey: process.env.VITE_AIRTABLE_ACCESS_TOKEN
});

const base = Airtable.base('appNAUPSEyCYlPtvG');

const BATCH_SIZE = 1000;

async function migrateCreators() {
	try {
		await prisma.creator.deleteMany({});
		console.log('Creator table cleared');

		const creators = await base('creators').select().all();
		const creatorData = creators.map((record) => ({
			id: record.id,
			name: record.get('name'),
			siteUrl: record.get('site'),
			createdAt: new Date(record.get('createdTime')),
			updatedAt: new Date(record.get('lastUpdated'))
		}));

		// Create creators
		for (let i = 0; i < creatorData.length; i += BATCH_SIZE) {
			const batch = creatorData.slice(i, i + BATCH_SIZE);
			await prisma.creator.createMany({
				data: batch,
				skipDuplicates: true
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
			topic: record.get('topic'),
			title: record.get('title'),
			icon: record.get('icon'),
			description: record.get('description'),
			createdAt: new Date(record.get('createdTime')),
			updatedAt: new Date(record.get('lastUpdated'))
		}));

		// Create spaces
		for (let i = 0; i < spaceData.length; i += BATCH_SIZE) {
			const batch = spaceData.slice(i, i + BATCH_SIZE);
			await prisma.space.createMany({
				data: batch,
				skipDuplicates: true
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
		await Promise.all([
			prisma.extract.deleteMany({}),
			prisma.extractFormat.deleteMany({}),
			prisma.extractRelation.deleteMany({})
		]);
		console.log('Extract, ExtractFormat, and ExtractRelation tables cleared');

		const extracts = await base('extracts').select().all();
		const uniqueFormats = new Set();

		// Step 1: Prepare non-relational data
		const extractData = extracts.map((record) => {
			const format = record.get('format');
			if (format) uniqueFormats.add(format);

			return {
				id: record.id,
				title: record.get('title'),
				extract: record.get('extract'),
				notes: record.get('notes'),
				sourceUrl: record.get('source'),
				michelinStars: record.get('michelinStars'),
				createdAt: new Date(record.get('extractedOn')),
				updatedAt: new Date(record.get('lastUpdated')),
				publishedOn: new Date(record.get('publishedOn'))
			};
		});

		// Step 2: Create ExtractFormat records in batches
		const formatData = Array.from(uniqueFormats).map((format) => ({ name: format }));

		await Promise.all([
			// Create ExtractFormat records
			(async () => {
				for (let i = 0; i < formatData.length; i += BATCH_SIZE) {
					const batch = formatData.slice(i, i + BATCH_SIZE);
					await prisma.extractFormat.createMany({
						data: batch,
						skipDuplicates: true
					});
					console.log(`Processed ${i + batch.length} extract formats`);
				}
			})(),
			// Create Extract records
			(async () => {
				for (let i = 0; i < extractData.length; i += BATCH_SIZE) {
					const batch = extractData.slice(i, i + BATCH_SIZE);
					await prisma.extract.createMany({
						data: batch,
						skipDuplicates: true
					});
					console.log(`Processed ${i + batch.length} extracts`);
				}
			})()
		]);

		// Step 4: Update relations in small, parallelized batches
		const formatMap = new Map((await prisma.extractFormat.findMany()).map((f) => [f.name, f.id]));

		for (let i = 0; i < extracts.length; i += 20) {
			const batch = extracts.slice(i, i + 20);
			const updatePromises = batch.map(async (record) => {
				const updateData = {
					where: { id: record.id },
					data: {
						formatId: record.get('format') ? formatMap.get(record.get('format')) : null,
						creators: {
							set: record.get('creators')?.map((id) => ({ id })) || []
						},
						spaces: {
							set: record.get('spaces')?.map((id) => ({ id })) || []
						},
						parentId: record.get('parent')?.[0] || null
					}
				};

				await prisma.extract.update(updateData);
				console.log(`Updated relations for ${record.get('title')}`);
			});

			await Promise.all(updatePromises);
		}

		// Step 5: Create ExtractRelation records
		const relationData = extracts.flatMap((record) =>
			(record.get('connections') || []).map((connectionId) => ({
				fromId: record.id,
				toId: connectionId,
				annotation: record.get('connectionAnnotations')?.[connectionId]
			}))
		);

		for (let i = 0; i < relationData.length; i += BATCH_SIZE) {
			const batch = relationData.slice(i, i + BATCH_SIZE);
			await prisma.extractRelation.createMany({
				data: batch,
				skipDuplicates: true
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
	// await migrateCreators();
	// await migrateSpaces();
	await migrateExtracts();
}

migrateAll();
