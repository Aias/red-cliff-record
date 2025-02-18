import { and, inArray, isNull } from 'drizzle-orm';
import { eq, isNotNull } from 'drizzle-orm';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import { db } from '@/server/db/connections';
import {
	indices,
	media,
	raindropBookmarks,
	raindropBookmarkTags,
	raindropTags,
	recordCategories,
	recordMedia,
	records,
} from '@/server/db/schema';
import type {
	IndicesInsert,
	MediaInsert,
	RaindropBookmarkSelect,
	RaindropTagSelect,
	RecordInsert,
} from '@/server/db/schema';

export async function createRaindropTags(integrationRunId?: number) {
	console.log('Processing bookmark tags...');
	const bookmarks = await db.query.raindropBookmarks.findMany({
		where: and(
			isNotNull(raindropBookmarks.tags),
			integrationRunId ? eq(raindropBookmarks.integrationRunId, integrationRunId) : undefined
		),
	});

	if (bookmarks.length === 0) {
		console.log('No new or updated bookmarks to process.');
		return;
	}

	const uniqueTags = [...new Set(bookmarks.map((bookmark) => bookmark.tags as string[]).flat())];

	const insertedTags = await db
		.insert(raindropTags)
		.values(uniqueTags.map((tag) => ({ tag })))
		.onConflictDoUpdate({
			target: raindropTags.tag,
			set: {
				recordUpdatedAt: new Date(),
			},
		})
		.returning();

	console.log(`Upserted ${insertedTags.length} tags.`);

	const tagMap = new Map(insertedTags.map((tag) => [tag.tag, tag.id]));

	console.log('Clearing existing bookmark tags...');
	if (integrationRunId) {
		// If we're running for a specific integration run, clear any existing tags for existing bookmarks.
		const bookmarkIds = bookmarks.map((bookmark) => bookmark.id);
		const deletedBookmarkTags = await db
			.delete(raindropBookmarkTags)
			.where(inArray(raindropBookmarkTags.bookmarkId, bookmarkIds))
			.returning();
		console.log(
			`Deleted ${deletedBookmarkTags.length} bookmark tags for ${bookmarks.length} bookmarks in integration run ${integrationRunId}.`
		);
	} else {
		// If we're not running for a specific integration run, clear all existing tags.
		await db.delete(raindropBookmarkTags);
		console.log(`Deleted all bookmark tags.`);
	}

	const bookmarkTagPromises = bookmarks.flatMap((bookmark) => {
		if (!bookmark.tags) return [];
		return bookmark.tags.map(async (tag) => {
			const tagId = tagMap.get(tag);
			if (!tagId) return null;

			const [bookmarkTag] = await db
				.insert(raindropBookmarkTags)
				.values({ bookmarkId: bookmark.id, tagId })
				.onConflictDoUpdate({
					target: [raindropBookmarkTags.bookmarkId, raindropBookmarkTags.tagId],
					set: {
						recordUpdatedAt: new Date(),
					},
				})
				.returning();

			return bookmarkTag;
		});
	});

	const newBookmarkTags = (await Promise.all(bookmarkTagPromises)).filter(Boolean);
	console.log(`Inserted ${newBookmarkTags.length} bookmark tags.`);
	return bookmarks;
}

export const mapRaindropBookmarkToRecord = (bookmark: RaindropBookmarkSelect): RecordInsert => {
	return {
		title: bookmark.title,
		url: bookmark.linkUrl,
		content: bookmark.excerpt,
		notes: bookmark.note,
		flags: bookmark.important ? ['important'] : null,
		sources: ['raindrop'],
		isPrivate: false,
		needsCuration: true,
		recordCreatedAt: bookmark.recordCreatedAt,
		recordUpdatedAt: bookmark.recordUpdatedAt,
		contentCreatedAt: bookmark.contentCreatedAt,
		contentUpdatedAt: bookmark.contentUpdatedAt,
	};
};

export async function createRecordsFromRaindropBookmarks() {
	console.log('Creating records from Raindrop bookmarks');
	const unmappedBookmarks = await db.query.raindropBookmarks.findMany({
		where: isNull(raindropBookmarks.recordId),
		with: {
			collection: true,
			bookmarkTags: {
				with: {
					tag: true,
				},
			},
		},
	});

	if (unmappedBookmarks.length === 0) {
		console.log('No new or updated bookmarks to process.');
		return;
	}

	for (const bookmark of unmappedBookmarks) {
		const newRecordDefaults = mapRaindropBookmarkToRecord(bookmark);
		const [newRecord] = await db
			.insert(records)
			.values(newRecordDefaults)
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		await db
			.update(raindropBookmarks)
			.set({ recordId: newRecord.id })
			.where(eq(raindropBookmarks.id, bookmark.id));

		for (const tag of bookmark.bookmarkTags) {
			if (tag.tag.indexEntryId) {
				await db
					.insert(recordCategories)
					.values({
						recordId: newRecord.id,
						categoryId: tag.tag.indexEntryId,
						type: 'file_under',
					})
					.onConflictDoNothing();
			}
		}
		if (bookmark.mediaId) {
			console.log(`Linking media ${bookmark.mediaId} to record ${newRecord.id}`);
			await db
				.insert(recordMedia)
				.values({ recordId: newRecord.id, mediaId: bookmark.mediaId })
				.onConflictDoNothing();
		}
	}
}

const mapRaindropBookmarkToMedia = async (
	bookmark: RaindropBookmarkSelect
): Promise<MediaInsert | null> => {
	if (!bookmark.coverImageUrl) return null;

	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(bookmark.coverImageUrl);

		return {
			url: bookmark.coverImageUrl,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			sources: ['raindrop'],
			isPrivate: false,
			needsCuration: true,
			recordCreatedAt: bookmark.recordCreatedAt,
			recordUpdatedAt: bookmark.recordUpdatedAt,
			contentCreatedAt: bookmark.contentCreatedAt,
			contentUpdatedAt: bookmark.contentUpdatedAt,
		};
	} catch (error) {
		console.error(
			'Error getting smart metadata for bookmark',
			bookmark.id,
			bookmark.coverImageUrl,
			error
		);
		return null;
	}
};

export async function createMediaFromRaindropBookmarks() {
	console.log('Creating media from Raindrop bookmarks');
	const unmappedBookmarks = await db.query.raindropBookmarks.findMany({
		where: and(
			isNotNull(raindropBookmarks.coverImageUrl),
			isNull(raindropBookmarks.mediaId),
			isNotNull(raindropBookmarks.recordId)
		),
	});
	if (unmappedBookmarks.length === 0) {
		console.log('No new or updated bookmarks to process.');
		return;
	}

	for (const bookmark of unmappedBookmarks) {
		const newMedia = await mapRaindropBookmarkToMedia(bookmark);
		if (!newMedia) {
			console.log(`Invalid image for bookmark ${bookmark.id}, setting cover image to null`);
			await db
				.update(raindropBookmarks)
				.set({ coverImageUrl: null })
				.where(eq(raindropBookmarks.id, bookmark.id));
			continue;
		}

		console.log(
			`Creating media for bookmark ${bookmark.id}`,
			newMedia.url,
			newMedia.contentTypeString
		);
		const [newMediaRecord] = await db
			.insert(media)
			.values(newMedia)
			.onConflictDoUpdate({
				target: [media.url],
				set: {
					recordUpdatedAt: new Date(),
				},
			})
			.returning({ id: media.id });
		if (!newMediaRecord) {
			throw new Error('Failed to create media');
		}
		console.log(`Linking bookmark to media ${newMediaRecord.id}`);
		await db
			.update(raindropBookmarks)
			.set({ mediaId: newMediaRecord.id })
			.where(eq(raindropBookmarks.id, bookmark.id));

		if (bookmark.recordId) {
			console.log(`Linking associated record to media ${bookmark.recordId}`);
			await db
				.insert(recordMedia)
				.values({
					recordId: bookmark.recordId,
					mediaId: newMediaRecord.id,
				})
				.onConflictDoNothing();
		}
	}
}

export const mapRaindropTagToCategory = (tag: RaindropTagSelect): IndicesInsert => {
	return {
		mainType: 'category',
		name: tag.tag,
		sources: ['raindrop'],
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: tag.recordCreatedAt,
		recordUpdatedAt: tag.recordUpdatedAt,
	};
};

export async function createCategoriesFromRaindropTags() {
	console.log('Creating categories from Raindrop tags');
	const unmappedTags = await db.query.raindropTags.findMany({
		where: isNull(raindropTags.indexEntryId),
		with: {
			tagBookmarks: {
				with: {
					bookmark: {
						columns: {
							id: true,
							recordId: true,
						},
					},
				},
			},
		},
	});

	for (const tag of unmappedTags) {
		const newCategoryDefaults = mapRaindropTagToCategory(tag);
		const [newCategory] = await db
			.insert(indices)
			.values(newCategoryDefaults)
			.returning({ id: indices.id })
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: {
					recordUpdatedAt: new Date(),
					needsCuration: true,
				},
			});
		if (!newCategory) {
			throw new Error('Failed to create category');
		}
		await db
			.update(raindropTags)
			.set({ indexEntryId: newCategory.id })
			.where(eq(raindropTags.id, tag.id));

		for (const bookmark of tag.tagBookmarks) {
			if (bookmark.bookmark.recordId) {
				await db
					.insert(recordCategories)
					.values({
						recordId: bookmark.bookmark.recordId,
						categoryId: newCategory.id,
						type: 'file_under',
					})
					.onConflictDoNothing();
			}
		}
	}
}
