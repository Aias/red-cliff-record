import type { CollectionsResponse } from './types';


export async function getAllCollections() {
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
