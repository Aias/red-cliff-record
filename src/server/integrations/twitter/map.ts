import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { getSmartMetadata } from '@/app/lib/server/content-helpers';
import { db } from '@/server/db/connections';
import {
	media,
	recordCreators,
	records,
	twitterMedia,
	twitterTweets,
	twitterUsers,
	type MediaInsert,
	type RecordInsert,
	type TwitterMediaSelect,
	type TwitterTweetSelect,
	type TwitterUserSelect,
} from '@/server/db/schema';
import { uploadMediaToR2 } from '../common/media-helpers';

export const mapTwitterUserToRecord = (user: TwitterUserSelect): RecordInsert => {
	return {
		id: user.recordId ?? undefined,
		type: 'entity',
		title: user.displayName,
		abbreviation: `@${user.username}`,
		summary: user.description || null,
		url: user.externalUrl ?? `https://x.com/${user.username}`,
		avatarUrl: user.profileImageUrl,
		needsCuration: true,
		isPrivate: false,
		isIndexNode: true,
		sources: ['twitter'],
		recordCreatedAt: user.recordCreatedAt,
		recordUpdatedAt: user.recordUpdatedAt,
		contentCreatedAt: user.contentCreatedAt,
		contentUpdatedAt: user.contentUpdatedAt,
	};
};

export async function createRecordsFromTwitterUsers() {
	console.log('Creating records from Twitter users');
	const users = await db.query.twitterUsers.findMany({
		where: isNull(twitterUsers.recordId),
	});

	if (users.length === 0) {
		console.log('No new or updated users to process.');
		return;
	}

	for (const user of users) {
		const entity = mapTwitterUserToRecord(user);
		const [newRecord] = await db
			.insert(records)
			.values(entity)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		await db
			.update(twitterUsers)
			.set({ recordId: newRecord.id })
			.where(eq(twitterUsers.id, user.id));
		console.log(`Created record ${newRecord.id} for user ${user.username}`);
	}
}

type TweetData = TwitterTweetSelect & {
	user: TwitterUserSelect;
	quotedTweet: TwitterTweetSelect | null;
};

export const mapTwitterTweetToRecord = (tweet: TweetData): RecordInsert => {
	return {
		id: tweet.recordId ?? undefined,
		type: 'artifact',
		content: tweet.text,
		url: `https://x.com/${tweet.user.username}/status/${tweet.id}`,
		parentId: tweet.quotedTweet?.recordId ?? null,
		childType: tweet.quotedTweet ? 'quotes' : null,
		isPrivate: false,
		needsCuration: true,
		sources: ['twitter'],
		recordCreatedAt: tweet.recordCreatedAt,
		recordUpdatedAt: tweet.recordUpdatedAt,
		contentCreatedAt: tweet.contentCreatedAt,
		contentUpdatedAt: tweet.contentUpdatedAt,
	};
};

export async function createRecordsFromTweets() {
	console.log('Creating records from Twitter tweets');
	const tweets = await db.query.twitterTweets.findMany({
		where: isNull(twitterTweets.recordId),
		with: { user: true, media: true, quotedTweet: true },
	});

	if (tweets.length === 0) {
		console.log('No new or updated tweets to process.');
		return;
	}

	const updatedTweetIds: string[] = [];
	// Map to store the new record IDs keyed by the corresponding Twitter tweet ID.
	const recordMap = new Map<string, number>();

	for (const tweet of tweets) {
		const record = mapTwitterTweetToRecord(tweet);
		// Insert the record with parentId set to null (to be updated later if this is a quote).
		const [newRecord] = await db.insert(records).values(record).returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}
		console.log(
			`Created record ${newRecord.id} for tweet ${tweet.text?.slice(0, 20)} (${tweet.id})`
		);
		await db
			.update(twitterTweets)
			.set({ recordId: newRecord.id })
			.where(eq(twitterTweets.id, tweet.id));
		updatedTweetIds.push(tweet.id);
		recordMap.set(tweet.id, newRecord.id);
		// Link the tweet creator via recordCreators.
		if (tweet.user.recordId) {
			await db
				.insert(recordCreators)
				.values({
					recordId: newRecord.id,
					creatorId: tweet.user.recordId,
					creatorRole: 'creator',
				})
				.onConflictDoUpdate({
					target: [recordCreators.recordId, recordCreators.creatorId, recordCreators.creatorRole],
					set: { recordUpdatedAt: new Date() },
				});
		}
		// Link the tweet media via recordMedia.
		tweet.media.forEach(async (mediaItem) => {
			if (mediaItem.mediaId) {
				console.log(`Linking media ${mediaItem.mediaId} to record ${newRecord.id}`);
				await db
					.update(media)
					.set({ recordId: newRecord.id })
					.where(eq(media.id, mediaItem.mediaId));
			}
		});
	}

	// Update parent-child relationships for tweets that are quoting another tweet.
	await linkQuotedTweets(updatedTweetIds);
}

export async function linkQuotedTweets(tweetIds: string[]) {
	const tweetsWithQuotes = await db.query.twitterTweets.findMany({
		where: and(inArray(twitterTweets.id, tweetIds), isNotNull(twitterTweets.quotedTweetId)),
		with: { quotedTweet: true },
	});

	if (tweetsWithQuotes.length === 0) {
		console.log('No new or updated tweets with quotes to process.');
		return;
	}

	console.log(`Linking ${tweetsWithQuotes.length} tweets with quotes to records`);

	for (const tweet of tweetsWithQuotes) {
		// The quoted tweet should already have been processed.
		const quotedTweet = tweet.quotedTweet!;
		if (!tweet.recordId || !quotedTweet.recordId) {
			console.log(`Quoted tweet ${tweet.id} not linked to record`);
			continue;
		}
		// Update the tweet's record with the parent's record id.
		console.log(
			`Setting parentId of tweet record ${tweet.recordId} to quoted tweet record ${quotedTweet.recordId}`
		);
		await db
			.update(records)
			.set({ parentId: quotedTweet.recordId, childType: 'quotes' })
			.where(eq(records.id, tweet.recordId));
	}
}

type MediaWithTweet = TwitterMediaSelect & {
	tweet: TwitterTweetSelect;
};

export const mapTwitterMediaToMedia = async (
	media: MediaWithTweet
): Promise<MediaInsert | null> => {
	let mediaUrl = media.mediaUrl;
	try {
		const newUrl = await uploadMediaToR2(mediaUrl);
		mediaUrl = newUrl;
		console.log(`Uploaded media ${media.mediaUrl} to ${newUrl}`);
		await db.update(twitterMedia).set({ mediaUrl: newUrl }).where(eq(twitterMedia.id, media.id));
		console.log(`Updated twitterMedia ${media.id} with new URL ${newUrl}`);
	} catch (error) {
		console.error('Error uploading media to R2', media.tweetUrl, media.mediaUrl, error);
		return null;
	}
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(mediaUrl);
		return {
			id: media.mediaId ?? undefined,
			url: mediaUrl,
			recordId: media.tweet.recordId ?? undefined,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			recordCreatedAt: media.tweet.recordCreatedAt,
			recordUpdatedAt: media.tweet.recordUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', media.tweetUrl, media.mediaUrl, error);
		return null;
	}
};

export async function createMediaFromTweets() {
	console.log('Creating media from Twitter tweets');
	const mediaWithTweets = await db.query.twitterMedia.findMany({
		where: and(isNull(twitterMedia.mediaId), isNull(twitterMedia.deletedAt)),
		with: {
			tweet: true,
		},
	});

	if (mediaWithTweets.length === 0) {
		console.log('No new or updated tweets without media to process.');
		return;
	}

	console.log(`Creating ${mediaWithTweets.length} media from tweets`);

	for (const item of mediaWithTweets) {
		const mediaItem = await mapTwitterMediaToMedia(item);
		if (!mediaItem) {
			console.log(
				`Failed to create media for tweet ${item.tweetUrl}: ${item.mediaUrl}, deleting source media.`
			);
			await db
				.update(twitterMedia)
				.set({ mediaId: null, deletedAt: new Date() })
				.where(eq(twitterMedia.id, item.id));
			continue;
		}
		console.log(`Creating media for ${mediaItem.url}`);
		const [newMedia] = await db
			.insert(media)
			.values(mediaItem)
			.onConflictDoUpdate({
				target: [media.url, media.recordId],
				set: {
					recordUpdatedAt: new Date(),
				},
			})
			.returning({ id: media.id });
		if (!newMedia) {
			throw new Error('Failed to create media');
		}
		console.log(`Created media ${newMedia.id} for ${mediaItem.url}`);
		await db
			.update(twitterMedia)
			.set({ mediaId: newMedia.id, mediaUrl: mediaItem.url })
			.where(eq(twitterMedia.id, item.id));

		if (item.tweet.recordId) {
			console.log(`Linking media ${newMedia.id} to record ${item.tweet.recordId}`);
			await db
				.update(media)
				.set({ recordId: item.tweet.recordId })
				.where(eq(media.id, newMedia.id));
		}
	}
}
