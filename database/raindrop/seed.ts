import { db } from '../src/db';
import {
	integrations,
	integrationRuns,
	RunType,
	IntegrationType,
	IntegrationStatus,
	bookmarks
} from '../src/schema';
import { eq } from 'drizzle-orm';

interface Raindrop {
	_id: number;
	title: string;
	excerpt: string;
	link: string;
	created: string;
	lastUpdate: string;
	tags: string[];
	type: string;
	cover?: string;
	note: string;
	domain: string;
	user: {
		$ref: string;
		$id: number;
	};
	media: Array<{
		link: string;
		type: string;
	}>;
	collection: {
		$ref: string;
		$id: number;
		oid: number;
	};
	highlights: any[];
	important: boolean;
	removed: boolean;
	creatorRef: {
		_id: number;
		avatar: string;
		name: string;
		email: string;
	};
	sort: number;
	broken: boolean;
	cache?: {
		status: string;
		size: number;
		created: string;
	};
	collectionId: number;
}

interface RaindropResponse {
	items: Raindrop[];
	count: number;
	result: boolean;
}

interface RaindropCollection {
	_id: number;
	access: {
		level: number;
		draggable: boolean;
	};
	collaborators: {
		$id: string;
	};
	color?: string;
	count: number;
	cover?: string[];
	created: string;
	expanded: boolean;
	lastUpdate: string;
	parent?: {
		$id: number;
	};
	public: boolean;
	sort: number;
	title: string;
	user: {
		$id: number;
	};
	view: string;
}

interface CollectionsResponse {
	items: RaindropCollection[];
	result: boolean;
}

async function getAllRaindrops() {
	try {
		console.log('🌧️  Starting to fetch all raindrops...');
		let allRaindrops: Raindrop[] = [];
		let page = 0;
		let hasMore = true;
		let totalFetched = 0;

		while (hasMore) {
			console.log(`📥 Fetching page ${page + 1}...`);
			const response = await fetch(
				`https://api.raindrop.io/rest/v1/raindrops/0?perpage=50&page=${page}`,
				{
					headers: {
						Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
					}
				}
			);

			if (!response.ok) {
				throw new Error(`API request failed with status ${response.status}`);
			}

			const data = (await response.json()) as RaindropResponse;
			allRaindrops = [...allRaindrops, ...data.items];
			totalFetched += data.items.length;

			console.log(`✅ Received ${data.items.length} raindrops (total: ${totalFetched})`);

			hasMore = data.items.length === 50;
			page++;
		}

		console.log(`🎉 Successfully fetched all ${totalFetched} raindrops!`);
		return allRaindrops;
	} catch (error) {
		console.error('❌ Failed to fetch raindrops:', error);
		throw error;
	}
}

async function getAllCollections() {
	try {
		console.log('📚 Fetching root collections...');
		const rootResponse = await fetch('https://api.raindrop.io/rest/v1/collections', {
			headers: {
				Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
			}
		});

		if (!rootResponse.ok) {
			throw new Error(`Root collections API request failed with status ${rootResponse.status}`);
		}

		const rootData = (await rootResponse.json()) as CollectionsResponse;

		console.log('👶 Fetching child collections...');
		const childrenResponse = await fetch('https://api.raindrop.io/rest/v1/collections/childrens', {
			headers: {
				Authorization: `Bearer ${process.env.RAINDROP_TEST_TOKEN}`
			}
		});

		if (!childrenResponse.ok) {
			throw new Error(
				`Child collections API request failed with status ${childrenResponse.status}`
			);
		}

		const childrenData = (await childrenResponse.json()) as CollectionsResponse;

		// Combine root and child collections
		const allCollections = [...rootData.items, ...childrenData.items];
		console.log(`✅ Retrieved ${allCollections.length} total collections`);

		// Create a map of collection ID to title for easy lookup
		const collectionsMap = new Map<number, string>();
		allCollections.forEach((collection) => {
			collectionsMap.set(collection._id, collection.title);
		});

		return collectionsMap;
	} catch (error) {
		console.error('❌ Failed to fetch collections:', error);
		throw error;
	}
}

const main = async () => {
	const integrationType = await db
		.select()
		.from(integrations)
		.where(eq(integrations.type, IntegrationType.RAINDROP));

	if (integrationType.length === 0) {
		console.error('Could not find corresponding integration type for Raindrop bookmarks.');
		return;
	}

	const run = await db
		.insert(integrationRuns)
		.values({
			type: RunType.FULL,
			integrationId: integrationType[0].id,
			runStartTime: new Date()
		})
		.returning();

	if (run.length === 0) {
		console.error('Could not create integration run.');
		return;
	}
	console.log(`Created integration run with id ${run[0].id}`);

	try {
		console.log('Deleting existing bookmarks.');
		await db.delete(bookmarks);
		console.log('Bookmarks deleted.');

		// Get collections first
		const collectionsMap = await getAllCollections();
		console.log(`Built collections map with ${collectionsMap.size} entries`);

		const raindrops = await getAllRaindrops();
		console.log(`Retrieved ${raindrops.length} raindrops`);

		const bookmarkData = raindrops.map((raindrop) => ({
			url: raindrop.link,
			title: raindrop.title,
			content: raindrop.excerpt,
			notes: raindrop.note,
			type: raindrop.type,
			// Use collection title from our map, fallback to "Unsorted" for collection ID -1
			category:
				raindrop.collectionId === -1
					? 'Unsorted'
					: collectionsMap.get(raindrop.collectionId) ||
						`Unknown Collection ${raindrop.collectionId}`,
			tags: raindrop.tags,
			starred: raindrop.important,
			imageUrl: raindrop.cover,
			integrationRunId: run[0].id
		}));

		console.log(`Inserting ${bookmarkData.length} rows into bookmarks`);
		const chunkSize = 100;
		for (let i = 0; i < bookmarkData.length; i += chunkSize) {
			const chunk = bookmarkData.slice(i, i + chunkSize);
			await db.insert(bookmarks).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(bookmarkData.length / chunkSize)}`
			);
		}
		console.log('Bookmark rows inserted.');

		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.SUCCESS,
				runEndTime: new Date(),
				entriesCreated: bookmarkData.length
			})
			.where(eq(integrationRuns.id, run[0].id));
		console.log(`Updated integration run with id ${run[0].id}`);
	} catch (err) {
		console.error('Error inserting bookmarks:', err);
		await db
			.update(integrationRuns)
			.set({ status: IntegrationStatus.FAIL, runEndTime: new Date() })
			.where(eq(integrationRuns.id, run[0].id));
		console.error(`Updated integration run with id ${run[0].id} to failed`);
	}
};

main();
