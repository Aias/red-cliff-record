import { eq, isNull } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	raindropBookmarks,
	raindropCollections,
	type RaindropBookmarkSelect,
	type RaindropCollectionSelect,
} from '~/server/db/schema/raindrop';
import { createEmbedding, type EmbeddingType } from '~/server/services/ai/create-embedding';
import { runIntegration } from '../common/run-integration';

// Collection implementation
class RaindropCollection implements EmbeddingType {
	constructor(
		private collection: RaindropCollectionSelect & {
			raindrops?: {
				title: string | null;
				linkUrl: string | null;
			}[];
		}
	) {}

	getEmbeddingText(): string {
		const textParts = [
			'# Collection Information',
			`Title: ${this.collection.title || '—'}`,
			`Color: ${this.collection.colorHex || '—'}`,
			`Cover URL: ${this.collection.coverUrl || '—'}`,
			`Raindrop Count: ${this.collection.raindropCount || '—'}`,
		];

		if (this.collection.raindrops?.length) {
			textParts.push(
				'',
				'# Bookmarks in Collection',
				...this.collection.raindrops.map(
					(raindrop) => `${raindrop.title || '—'} (${raindrop.linkUrl || '—'})`
				)
			);
		}

		return textParts.join('\n');
	}
}

// Bookmark implementation
class RaindropBookmark implements EmbeddingType {
	constructor(
		private bookmark: RaindropBookmarkSelect & {
			collection?: {
				title: string | null;
				parentId: number | null;
			} | null;
		}
	) {}

	getEmbeddingText(): string {
		const textParts = [
			'# Bookmark Information',
			`Title: ${this.bookmark.title || '—'}`,
			`URL: ${this.bookmark.linkUrl || '—'}`,
			`Excerpt: ${this.bookmark.excerpt || '—'}`,
			`Note: ${this.bookmark.note || '—'}`,
			`Type: ${this.bookmark.type || '—'}`,
			`Domain: ${this.bookmark.domain || '—'}`,
			`Tags: ${this.bookmark.tags?.join(', ') || '—'}`,
			`Important: ${this.bookmark.important ? 'Yes' : 'No'}`,
		];

		if (this.bookmark.collection) {
			textParts.push(
				'',
				'# Collection Information',
				`Collection: ${this.bookmark.collection.title || '—'}`,
				`Parent Collection ID: ${this.bookmark.collection.parentId || '—'}`
			);
		}

		return textParts.join('\n');
	}
}

// Fetch and update functions
async function updateCollectionEmbeddings() {
	const collections = await db.query.raindropCollections.findMany({
		with: {
			raindrops: {
				columns: {
					title: true,
					linkUrl: true,
				},
				limit: 10, // Get 10 most recent bookmarks
				orderBy: (fields, { desc }) => [desc(fields.contentCreatedAt)],
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const collection of collections) {
		const embeddingText = new RaindropCollection(collection).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db
			.update(raindropCollections)
			.set({ embedding })
			.where(eq(raindropCollections.id, collection.id));
		count++;
	}
	return count;
}

async function updateBookmarkEmbeddings() {
	const bookmarks = await db.query.raindropBookmarks.findMany({
		with: {
			collection: {
				columns: {
					title: true,
					parentId: true,
				},
			},
		},
		where: (fields) => isNull(fields.embedding),
	});

	let count = 0;
	for (const bookmark of bookmarks) {
		const embeddingText = new RaindropBookmark(bookmark).getEmbeddingText();
		const embedding = await createEmbedding(embeddingText);
		await db
			.update(raindropBookmarks)
			.set({ embedding })
			.where(eq(raindropBookmarks.id, bookmark.id));
		count++;
	}
	return count;
}

// Sync function
async function syncRaindropEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync collections
	totalCount += await updateCollectionEmbeddings();

	// Sync bookmarks
	totalCount += await updateBookmarkEmbeddings();

	return totalCount;
}

const main = async () => {
	try {
		await runIntegration('embeddings', syncRaindropEmbeddings);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./embeddings.ts')) {
	main();
}

export { syncRaindropEmbeddings };
