import { and, inArray, isNull } from 'drizzle-orm';
import { eq, isNotNull } from 'drizzle-orm';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import { db } from '@/server/db/connections';
import {
	media,
	raindropBookmarks,
	raindropBookmarkTags,
	raindropTags,
	recordRelations,
	records,
} from '@/server/db/schema';
import type {
	MediaInsert,
	RaindropBookmarkSelect,
	RaindropTagSelect,
	RecordInsert,
} from '@/server/db/schema';
import { uploadMediaToR2 } from '../common/media-helpers';

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
		console.log(`Created record ${newRecord.id} for bookmark ${bookmark.title} (${bookmark.id})`);
		await db
			.update(raindropBookmarks)
			.set({ recordId: newRecord.id })
			.where(eq(raindropBookmarks.id, bookmark.id));

		for (const tag of bookmark.bookmarkTags) {
			if (tag.tag.recordId) {
				console.log(`Linking record ${newRecord.id} to tag ${tag.tag.recordId}`);
				await db
					.insert(recordRelations)
					.values({
						sourceId: newRecord.id,
						targetId: tag.tag.recordId,
						type: 'tagged',
					})
					.onConflictDoNothing();
			}
		}
		if (bookmark.mediaId) {
			console.log(`Linking media ${bookmark.mediaId} to record ${newRecord.id}`);
			await db.update(media).set({ recordId: newRecord.id }).where(eq(media.id, bookmark.mediaId));
		}
	}
}

const mapRaindropBookmarkToMedia = async (
	bookmark: RaindropBookmarkSelect
): Promise<MediaInsert | null> => {
	let mediaUrl = bookmark.coverImageUrl;
	if (!mediaUrl) return null;
	try {
		console.log(`Uploading media ${mediaUrl}`);
		const updatedUrl = await uploadMediaToR2(mediaUrl);
		if (!updatedUrl) {
			console.log(`Failed to transfer media ${mediaUrl}`);
			return null;
		}
		console.log(`Uploaded media for bookmark: ${bookmark.title} (${bookmark.id}) to ${updatedUrl}`);
		mediaUrl = updatedUrl;
		await db
			.update(raindropBookmarks)
			.set({ coverImageUrl: updatedUrl })
			.where(eq(raindropBookmarks.id, bookmark.id));
	} catch (error) {
		console.error('Error transferring media', error);
		return null;
	}
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(mediaUrl);

		return {
			id: bookmark.mediaId ?? undefined,
			url: mediaUrl,
			recordId: bookmark.recordId,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			recordCreatedAt: bookmark.recordCreatedAt,
			recordUpdatedAt: bookmark.recordUpdatedAt,
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
				target: [media.url, media.recordId],
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
				.update(media)
				.set({ recordId: bookmark.recordId })
				.where(eq(media.id, newMediaRecord.id));
		}
	}
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
	console.log('Creating categories from Raindrop tags');
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
		await db
			.update(raindropTags)
			.set({ recordId: newCategory.id })
			.where(eq(raindropTags.id, tag.id));

		for (const bookmark of tag.tagBookmarks) {
			if (bookmark.bookmark.recordId) {
				console.log(`Linking record ${bookmark.bookmark.recordId} to category ${newCategory.id}`);
				await db
					.insert(recordRelations)
					.values({
						sourceId: bookmark.bookmark.recordId,
						targetId: newCategory.id,
						type: 'tagged',
					})
					.onConflictDoNothing();
			}
		}
	}
}
