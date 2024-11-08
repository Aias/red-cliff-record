import { db } from '../src/db';
import { IntegrationType, bookmarks, integrationRuns } from '../src/schema';
import { eq, inArray } from 'drizzle-orm';
import { runIntegration } from '../lib/integration';

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
}

async function getAllCollections() {
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
		throw new Error(`Child collections API request failed with status ${childrenResponse.status}`);
	}

	const childrenData = (await childrenResponse.json()) as CollectionsResponse;

	const allCollections = [...rootData.items, ...childrenData.items];
	console.log(`✅ Retrieved ${allCollections.length} total collections`);

	const collectionsMap = new Map<number, string>();
	allCollections.forEach((collection) => {
		collectionsMap.set(collection._id, collection.title);
	});

	return collectionsMap;
}

async function processRaindrops(integrationRunId: number): Promise<number> {
	console.log('Starting Raindrop integration process...');

	console.log('Cleaning up existing Raindrop bookmarks...');
	await db
		.delete(bookmarks)
		.where(
			inArray(
				bookmarks.integrationRunId,
				db
					.select({ id: integrationRuns.id })
					.from(integrationRuns)
					.where(eq(integrationRuns.integrationType, IntegrationType.RAINDROP))
			)
		);
	console.log('Cleanup complete');

	// Get collections first
	const collectionsMap = await getAllCollections();
	console.log(`Built collections map with ${collectionsMap.size} entries`);

	const raindrops = await getAllRaindrops();
	console.log(`Retrieved ${raindrops.length} raindrops`);

	const bookmarkData = raindrops.map((raindrop) => ({
		url: raindrop.link,
		title: raindrop.title,
		content: raindrop.excerpt?.trim() || null,
		notes: raindrop.note?.trim() || null,
		type: raindrop.type,
		category:
			raindrop.collectionId === -1
				? 'Unsorted'
				: collectionsMap.get(raindrop.collectionId) ||
					`Unknown Collection ${raindrop.collectionId}`,
		tags: raindrop.tags,
		starred: raindrop.important,
		imageUrl: raindrop.cover,
		createdAt: new Date(raindrop.created),
		integrationRunId
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
	console.log('All bookmark rows inserted successfully');

	return bookmarkData.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.RAINDROP, processRaindrops);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed.ts')) {
	main();
}

export { main as seedRaindrops };
