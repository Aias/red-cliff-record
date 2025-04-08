import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import {
	media,
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
import { linkRecordToCreator, setRecordParent } from '../common/db-helpers';
import { createIntegrationLogger } from '../common/logging';
import { getMediaInsertData, uploadMediaToR2 } from '../common/media-helpers';

const logger = createIntegrationLogger('twitter', 'map');

/**
 * Maps a Twitter user to a record
 *
 * @param user - The Twitter user to map
 * @returns A record insert object
 */
export const mapTwitterUserToRecord = (user: TwitterUserSelect): RecordInsert => {
	return {
		id: user.recordId ?? undefined,
		type: 'entity',
		title: user.displayName,
		abbreviation: `@${user.username}`,
		summary: user.description || null,
		url: user.externalUrl ?? `https://x.com/${user.username}`,
		avatarUrl: user.profileImageUrl,
		isCurated: false,
		isPrivate: false,
		isIndexNode: true,
		sources: ['twitter'],
		recordCreatedAt: user.recordCreatedAt,
		recordUpdatedAt: user.recordUpdatedAt,
		contentCreatedAt: user.contentCreatedAt,
		contentUpdatedAt: user.contentUpdatedAt,
	};
};

/**
 * Creates records from Twitter users that don't have associated records yet
 */
export async function createRecordsFromTwitterUsers() {
	logger.start('Creating records from Twitter users');

	const users = await db.query.twitterUsers.findMany({
		where: {
			recordId: {
				isNull: true,
			},
			deletedAt: {
				isNull: true,
			},
		},
	});

	if (users.length === 0) {
		logger.skip('No new or updated users to process');
		return;
	}

	logger.info(`Found ${users.length} unmapped Twitter users`);

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

		logger.info(`Created record ${newRecord.id} for user ${user.username}`);
	}

	logger.complete(`Processed ${users.length} Twitter users`);
}

/**
 * Type for a tweet with its user and quoted tweet data
 */
type TweetData = TwitterTweetSelect & {
	user: TwitterUserSelect;
	quotedTweet: TwitterTweetSelect | null;
};

/**
 * Maps a Twitter tweet to a record
 *
 * @param tweet - The Twitter tweet to map
 * @returns A record insert object
 */
export const mapTwitterTweetToRecord = (tweet: TweetData): RecordInsert => {
	// Remove t.co URLs from the beginning or end of the tweet text
	const cleanedContent =
		tweet.text
			?.trim()
			.replace(/^https?:\/\/t\.co\/[^\s]+|https?:\/\/t\.co\/[^\s]+$/g, '')
			.trim() ?? '';

	return {
		id: tweet.recordId ?? undefined,
		type: 'artifact',
		content: cleanedContent,
		url: `https://x.com/${tweet.user.username}/status/${tweet.id}`,
		parentId: tweet.quotedTweet?.recordId ?? null,
		childType: tweet.quotedTweet ? 'quotes' : null,
		isPrivate: false,
		isCurated: false,
		sources: ['twitter'],
		recordCreatedAt: tweet.recordCreatedAt,
		recordUpdatedAt: tweet.recordUpdatedAt,
		contentCreatedAt: tweet.contentCreatedAt,
		contentUpdatedAt: tweet.contentUpdatedAt,
	};
};

/**
 * Creates records from tweets that don't have associated records yet
 */
export async function createRecordsFromTweets() {
	logger.start('Creating records from Twitter tweets');

	const tweets = await db.query.twitterTweets.findMany({
		where: {
			recordId: {
				isNull: true,
			},
			deletedAt: {
				isNull: true,
			},
		},
		with: { user: true, media: true, quotedTweet: true },
	});

	if (tweets.length === 0) {
		logger.skip('No new or updated tweets to process');
		return;
	}

	logger.info(`Found ${tweets.length} unmapped Twitter tweets`);

	const updatedTweetIds: string[] = [];
	// Map to store the new record IDs keyed by the corresponding Twitter tweet ID.
	const recordMap = new Map<string, number>();

	for (const tweet of tweets) {
		const record = mapTwitterTweetToRecord(tweet);

		// Insert the record with parentId set to null (to be updated later if this is a quote).
		const [newRecord] = await db
			.insert(records)
			.values(record)
			.onConflictDoUpdate({
				target: records.id,
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: records.id });
		if (!newRecord) {
			throw new Error('Failed to create record');
		}

		logger.info(
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
			await linkRecordToCreator(newRecord.id, tweet.user.recordId, 'creator');
		}

		// Link the tweet media via recordMedia.
		for (const mediaItem of tweet.media) {
			if (mediaItem.mediaId) {
				logger.info(`Linking media ${mediaItem.mediaId} to record ${newRecord.id}`);
				await db
					.update(media)
					.set({ recordId: newRecord.id })
					.where(eq(media.id, mediaItem.mediaId));
			}
		}
	}

	// Update parent-child relationships for tweets that are quoting another tweet.
	if (updatedTweetIds.length > 0) {
		await linkQuotedTweets(updatedTweetIds);
	}

	logger.complete(`Processed ${tweets.length} Twitter tweets`);
}

/**
 * Links quoted tweets to their parent tweets
 *
 * @param tweetIds - Array of tweet IDs to check for quotes
 */
export async function linkQuotedTweets(tweetIds: string[]) {
	logger.start('Linking quoted tweets');

	const tweetsWithQuotes = await db.query.twitterTweets.findMany({
		where: {
			id: {
				in: tweetIds,
			},
			quotedTweetId: {
				isNotNull: true,
			},
		},
		with: { quotedTweet: true },
	});

	if (tweetsWithQuotes.length === 0) {
		logger.skip('No tweets with quotes to process');
		return;
	}

	logger.info(`Found ${tweetsWithQuotes.length} tweets with quotes to link`);

	for (const tweet of tweetsWithQuotes) {
		// The quoted tweet should already have been processed.
		const quotedTweet = tweet.quotedTweet!;
		if (!tweet.recordId || !quotedTweet.recordId) {
			logger.warn(`Quoted tweet ${tweet.id} not linked to record`);
			continue;
		}

		// Update the tweet's record with the parent's record id.
		logger.info(
			`Setting parentId of tweet record ${tweet.recordId} to quoted tweet record ${quotedTweet.recordId}`
		);

		await setRecordParent(tweet.recordId, quotedTweet.recordId, 'quotes');
	}

	logger.complete(`Linked ${tweetsWithQuotes.length} quoted tweets`);
}

/**
 * Type for Twitter media with its associated tweet
 */
type MediaWithTweet = TwitterMediaSelect & {
	tweet: TwitterTweetSelect;
};

/**
 * Maps Twitter media to a media object
 *
 * @param media - The Twitter media to map
 * @returns A promise resolving to a media insert object or null if processing fails
 */
export const mapTwitterMediaToMedia = async (
	media: MediaWithTweet
): Promise<MediaInsert | null> => {
	// First upload to R2 if needed
	let mediaUrl = media.mediaUrl;
	try {
		const newUrl = await uploadMediaToR2(mediaUrl);
		if (!newUrl) {
			return null;
		}

		mediaUrl = newUrl;
		logger.info(`Uploaded media ${media.mediaUrl} to ${newUrl}`);

		await db.update(twitterMedia).set({ mediaUrl: newUrl }).where(eq(twitterMedia.id, media.id));

		logger.info(`Updated twitterMedia ${media.id} with new URL ${newUrl}`);
	} catch (error) {
		logger.error('Error uploading media to R2', error);
		return null;
	}

	// Then get metadata and create media object
	return getMediaInsertData(mediaUrl, {
		recordId: media.tweet.recordId,
		recordCreatedAt: media.tweet.recordCreatedAt,
		recordUpdatedAt: media.tweet.recordUpdatedAt,
	});
};

/**
 * Creates media from Twitter tweets that don't have associated media yet
 */
export async function createMediaFromTweets() {
	logger.start('Creating media from Twitter tweets');

	const mediaWithTweets = await db.query.twitterMedia.findMany({
		where: {
			mediaId: {
				isNull: true,
			},
			deletedAt: {
				isNull: true,
			},
		},
		with: {
			tweet: true,
		},
	});

	if (mediaWithTweets.length === 0) {
		logger.skip('No new or updated tweets without media to process');
		return;
	}

	logger.info(`Found ${mediaWithTweets.length} Twitter media items to process`);

	for (const item of mediaWithTweets) {
		const mediaItem = await mapTwitterMediaToMedia(item);
		if (!mediaItem) {
			logger.error(
				`Failed to create media for tweet ${item.tweetUrl}: ${item.mediaUrl}, deleting source media`
			);

			await db
				.update(twitterMedia)
				.set({ mediaId: null, deletedAt: new Date() })
				.where(eq(twitterMedia.id, item.id));

			continue;
		}

		logger.info(`Creating media for ${mediaItem.url}`);

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

		logger.info(`Created media ${newMedia.id} for ${mediaItem.url}`);

		await db
			.update(twitterMedia)
			.set({ mediaId: newMedia.id, mediaUrl: mediaItem.url })
			.where(eq(twitterMedia.id, item.id));

		if (item.tweet.recordId) {
			logger.info(`Linking media ${newMedia.id} to record ${item.tweet.recordId}`);

			await db
				.update(media)
				.set({ recordId: item.tweet.recordId })
				.where(eq(media.id, newMedia.id));
		}
	}

	logger.complete(`Processed ${mediaWithTweets.length} Twitter media items`);
}
