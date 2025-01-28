import { db } from '~/server/db/connections';
import {
	type raindropBookmarks,
	type raindropCollections,
} from '~/server/db/schema/integrations/raindrop';
import { syncEmbeddings, type EmbeddableDocument } from '../common/embeddings';
import { runIntegration } from '../common/run-integration';

// Collection implementation
class RaindropCollection implements EmbeddableDocument {
	constructor(
		private collection: typeof raindropCollections.$inferSelect & {
			raindrops?: {
				title: string | null;
				linkUrl: string | null;
			}[];
		}
	) {}

	get id() {
		return this.collection.id;
	}

	get tableName() {
		return 'integrations.raindrop_collections';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

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
class RaindropBookmark implements EmbeddableDocument {
	constructor(
		private bookmark: typeof raindropBookmarks.$inferSelect & {
			collection?: {
				title: string | null;
				parentId: number | null;
			} | null;
		}
	) {}

	get id() {
		return this.bookmark.id;
	}

	get tableName() {
		return 'integrations.raindrop_bookmarks';
	}

	get embeddingIdColumn() {
		return 'embedding_id';
	}

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

// Fetch functions
async function getCollectionsWithoutEmbeddings() {
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
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return collections.map((collection) => new RaindropCollection(collection));
}

async function getBookmarksWithoutEmbeddings() {
	const bookmarks = await db.query.raindropBookmarks.findMany({
		with: {
			collection: {
				columns: {
					title: true,
					parentId: true,
				},
			},
		},
		where: (fields, { isNull }) => isNull(fields.embeddingId),
	});
	return bookmarks.map((bookmark) => new RaindropBookmark(bookmark));
}

// Sync function
async function syncRaindropEmbeddings(): Promise<number> {
	let totalCount = 0;

	// Sync collections
	totalCount += await syncEmbeddings(getCollectionsWithoutEmbeddings, 'raindrop-collections');

	// Sync bookmarks
	totalCount += await syncEmbeddings(getBookmarksWithoutEmbeddings, 'raindrop-bookmarks');

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
