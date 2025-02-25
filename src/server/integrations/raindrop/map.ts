import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import {
	media,
	raindropBookmarks,
	raindropBookmarkTags,
	raindropTags,
	records,
	type MediaInsert,
	type RaindropBookmarkSelect,
	type RaindropTagSelect,
	type RecordInsert,
} from '@/server/db/schema';
import { linkRecords } from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';
import { getMediaMetadata, uploadToR2 } from '../common/record-mapping';

const logger = createIntegrationLogger('raindrop', 'map');

export async function createRaindropTags(integrationRunId?: number) {
	logger.start('Processing bookmark tags');

	const bookmarks = await db.query.raindropBookmarks.findMany({
		where: and(
			isNotNull(raindropBookmarks.tags),
			integrationRunId ? eq(raindropBookmarks.integrationRunId, integrationRunId) : undefined
		),
	});

	if (bookmarks.length === 0) {
		logger.skip('No new or updated bookmarks to process');
		return;
	}

	logger.info(`Found ${bookmarks.length} bookmarks with tags to process`);

	// Extract unique tags from all bookmarks
	const uniqueTags: string[] = [
		...new Set(
			bookmarks
				.map((bookmark) => bookmark.tags)
				.filter((tags): tags is string[] => tags !== null)
				.flat()
		),
	];

	// Insert or update tags
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

	logger.info(`Upserted ${insertedTags.length} tags`);

	// Create a map of tag names to tag IDs
	const tagMap = new Map(insertedTags.map((tag) => [tag.tag, tag.id]));

	// Clear existing bookmark-tag relationships
	logger.info('Clearing existing bookmark tags');

	if (integrationRunId) {
		// If we're running for a specific integration run, clear any existing tags for existing bookmarks.
		const bookmarkIds = bookmarks.map((bookmark) => bookmark.id);
		const deletedBookmarkTags = await db
			.delete(raindropBookmarkTags)
			.where(inArray(raindropBookmarkTags.bookmarkId, bookmarkIds))
			.returning();

		logger.info(
			`Deleted ${deletedBookmarkTags.length} bookmark tags for ${bookmarks.length} bookmarks in integration run ${integrationRunId}`
		);
	} else {
		// If we're not running for a specific integration run, clear all existing tags.
		await db.delete(raindropBookmarkTags);
		logger.info('Deleted all bookmark tags');
	}

	// Create new bookmark-tag relationships
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
	logger.info(`Inserted ${newBookmarkTags.length} bookmark tags`);

	logger.complete(`Processed tags for ${bookmarks.length} bookmarks`);
	return bookmarks;
}

export const mapRaindropBookmarkToRecord = (bookmark: RaindropBookmarkSelect): RecordInsert => {
	return {
		id: bookmark.recordId ?? undefined,
		type: 'artifact',
		title: bookmark.title,
		url: bookmark.linkUrl,
		content: bookmark.excerpt,
		notes: bookmark.note,
		rating: bookmark.important ? 1 : 0,
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
	logger.start('Creating records from Raindrop bookmarks');

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
		logger.skip('No new or updated bookmarks to process');
		return;
	}

	logger.info(`Found ${unmappedBookmarks.length} unmapped Raindrop bookmarks`);

	for (const bookmark of unmappedBookmarks) {
		const newRecordDefaults = mapRaindropBookmarkToRecord(bookmark);

		const [newRecord] = await db
			.insert(records)
			.values(newRecordDefaults)
			.returning({ id: records.id });

		if (!newRecord) {
			throw new Error('Failed to create record');
		}

		logger.info(`Created record ${newRecord.id} for bookmark ${bookmark.title} (${bookmark.id})`);

		await db
			.update(raindropBookmarks)
			.set({ recordId: newRecord.id })
			.where(eq(raindropBookmarks.id, bookmark.id));

		// Link tags to the record
		for (const tag of bookmark.bookmarkTags) {
			if (tag.tag.recordId) {
				logger.info(`Linking record ${newRecord.id} to tag ${tag.tag.recordId}`);
				await linkRecords(newRecord.id, tag.tag.recordId, 'tagged');
			}
		}

		// Link media to the record if it exists
		if (bookmark.mediaId) {
			logger.info(`Linking media ${bookmark.mediaId} to record ${newRecord.id}`);
			await db.update(media).set({ recordId: newRecord.id }).where(eq(media.id, bookmark.mediaId));
		}
	}

	logger.complete(`Processed ${unmappedBookmarks.length} Raindrop bookmarks`);
}

const mapRaindropBookmarkToMedia = async (
	bookmark: RaindropBookmarkSelect
): Promise<MediaInsert | null> => {
	if (!bookmark.coverImageUrl) return null;

	// First upload to R2 if needed
	let mediaUrl = bookmark.coverImageUrl;
	try {
		const newUrl = await uploadToR2(mediaUrl);
		if (!newUrl) {
			logger.error(`Failed to transfer media ${mediaUrl}`);
			return null;
		}

		mediaUrl = newUrl;
		logger.info(`Uploaded media for bookmark: ${bookmark.title} (${bookmark.id}) to ${mediaUrl}`);

		await db
			.update(raindropBookmarks)
			.set({ coverImageUrl: mediaUrl })
			.where(eq(raindropBookmarks.id, bookmark.id));
	} catch (error) {
		logger.error('Error transferring media', error);
		return null;
	}

	// Then get metadata and create media object
	return getMediaMetadata(mediaUrl, {
		recordId: bookmark.recordId,
		recordCreatedAt: bookmark.recordCreatedAt,
		recordUpdatedAt: bookmark.recordUpdatedAt,
	});
};

export async function createMediaFromRaindropBookmarks() {
	logger.start('Creating media from Raindrop bookmarks');

	const unmappedBookmarks = await db.query.raindropBookmarks.findMany({
		where: and(
			isNotNull(raindropBookmarks.coverImageUrl),
			isNull(raindropBookmarks.mediaId),
			isNotNull(raindropBookmarks.recordId)
		),
	});

	if (unmappedBookmarks.length === 0) {
		logger.skip('No new or updated bookmarks to process');
		return;
	}

	logger.info(`Found ${unmappedBookmarks.length} Raindrop bookmarks with cover images`);

	for (const bookmark of unmappedBookmarks) {
		const newMedia = await mapRaindropBookmarkToMedia(bookmark);
		if (!newMedia) {
			logger.warn(`Invalid image for bookmark ${bookmark.id}, setting cover image to null`);

			await db
				.update(raindropBookmarks)
				.set({ coverImageUrl: null })
				.where(eq(raindropBookmarks.id, bookmark.id));

			continue;
		}

		logger.info(
			`Creating media for bookmark ${bookmark.id}`,
			newMedia.url,
			newMedia.contentTypeString
		);

		const [newMediaRecord] = await db
			.insert(media)
			.values(newMedia)
			.onConflictDoUpdate({
				target: [media.url, media.recordId],
				set: {
					recordUpdatedAt: new Date(),
				},
			})
			.returning({ id: media.id });

		if (!newMediaRecord) {
			throw new Error('Failed to create media');
		}

		logger.info(`Linking bookmark to media ${newMediaRecord.id}`);

		await db
			.update(raindropBookmarks)
			.set({ mediaId: newMediaRecord.id })
			.where(eq(raindropBookmarks.id, bookmark.id));

		if (bookmark.recordId) {
			logger.info(`Linking associated record to media ${bookmark.recordId}`);

			await db
				.update(media)
				.set({ recordId: bookmark.recordId })
				.where(eq(media.id, newMediaRecord.id));
		}
	}

	logger.complete(`Processed ${unmappedBookmarks.length} Raindrop bookmark media`);
}

export const mapRaindropTagToRecord = (tag: RaindropTagSelect): RecordInsert => {
	return {
		id: tag.recordId ?? undefined,
		type: 'concept',
		title: tag.tag,
		sources: ['raindrop'],
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
		recordCreatedAt: tag.recordCreatedAt,
		recordUpdatedAt: tag.recordUpdatedAt,
	};
};

export async function createRecordsFromRaindropTags() {
	logger.start('Creating categories from Raindrop tags');

	const unmappedTags = await db.query.raindropTags.findMany({
		where: isNull(raindropTags.recordId),
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

	if (unmappedTags.length === 0) {
		logger.skip('No unmapped tags to process');
		return;
	}

	logger.info(`Found ${unmappedTags.length} unmapped Raindrop tags`);

	for (const tag of unmappedTags) {
		const newCategoryDefaults = mapRaindropTagToRecord(tag);

		const [newCategory] = await db
			.insert(records)
			.values(newCategoryDefaults)
			.returning({ id: records.id })
			.onConflictDoUpdate({
				target: records.id,
				set: {
					recordUpdatedAt: new Date(),
					needsCuration: true,
				},
			});

		if (!newCategory) {
			throw new Error('Failed to create category');
		}

		logger.info(`Created record ${newCategory.id} for tag ${tag.tag}`);

		await db
			.update(raindropTags)
			.set({ recordId: newCategory.id })
			.where(eq(raindropTags.id, tag.id));

		// Link bookmarks to the tag
		for (const bookmark of tag.tagBookmarks) {
			if (bookmark.bookmark.recordId) {
				logger.info(`Linking record ${bookmark.bookmark.recordId} to category ${newCategory.id}`);
				await linkRecords(bookmark.bookmark.recordId, newCategory.id, 'tagged');
			}
		}
	}

	logger.complete(`Processed ${unmappedTags.length} Raindrop tags`);
}
