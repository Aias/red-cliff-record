import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { getSmartMetadata } from '~/app/lib/server/content-helpers';
import { db } from '~/server/db/connections';
import {
	indices,
	media,
	recordCreators,
	recordMedia,
	records,
	twitterMedia,
	twitterTweets,
	twitterUsers,
	type IndicesInsert,
	type MediaInsert,
	type RecordInsert,
	type TwitterMediaSelect,
	type TwitterTweetSelect,
	type TwitterUserSelect,
} from '~/server/db/schema';

export const mapTwitterUserToEntity = (user: TwitterUserSelect): IndicesInsert => {
	return {
		name: user.displayName,
		shortName: `@${user.username}`,
		mainType: 'entity',
		sources: ['twitter'],
		canonicalUrl: user.externalUrl ?? `https://x.com/${user.username}`,
		canonicalMediaUrl: user.profileImageUrl,
		needsCuration: true,
		isPrivate: false,
		recordCreatedAt: user.recordCreatedAt,
		recordUpdatedAt: user.recordUpdatedAt,
		contentCreatedAt: user.contentCreatedAt,
		contentUpdatedAt: user.contentUpdatedAt,
	};
};

export async function createEntitiesFromUsers() {
	console.log('Creating entities from Twitter users');
	const users = await db.query.twitterUsers.findMany({
		where: isNull(twitterUsers.indexEntryId),
	});

	if (users.length === 0) {
		console.log('No new or updated users to process.');
		return;
	}

	for (const user of users) {
		const entity = mapTwitterUserToEntity(user);
		const [newEntity] = await db
			.insert(indices)
			.values(entity)
			.onConflictDoUpdate({
				target: [indices.mainType, indices.name, indices.sense],
				set: { recordUpdatedAt: new Date() },
			})
			.returning({ id: indices.id });
		if (!newEntity) {
			throw new Error('Failed to create entity');
		}
		await db
			.update(twitterUsers)
			.set({ indexEntryId: newEntity.id })
			.where(eq(twitterUsers.id, user.id));
	}
}

type TweetWithUser = TwitterTweetSelect & {
	user: TwitterUserSelect;
};

export const mapTwitterTweetToRecord = (tweet: TweetWithUser): RecordInsert => {
	return {
		content: tweet.text,
		url: `https://x.com/${tweet.user.username}/status/${tweet.id}`,
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
		with: { user: true, media: true },
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
		await db
			.update(twitterTweets)
			.set({ recordId: newRecord.id })
			.where(eq(twitterTweets.id, tweet.id));
		updatedTweetIds.push(tweet.id);
		recordMap.set(tweet.id, newRecord.id);
		// Link the tweet creator via recordCreators.
		if (tweet.user.indexEntryId) {
			await db
				.insert(recordCreators)
				.values({
					recordId: newRecord.id,
					entityId: tweet.user.indexEntryId,
					role: 'creator',
				})
				.onConflictDoUpdate({
					target: [recordCreators.recordId, recordCreators.entityId, recordCreators.role],
					set: { recordUpdatedAt: new Date() },
				});
		}
		// Link the tweet media via recordMedia.
		tweet.media.forEach(async (mediaItem) => {
			if (mediaItem.mediaId) {
				await db
					.insert(recordMedia)
					.values({ recordId: newRecord.id, mediaId: mediaItem.mediaId })
					.onConflictDoNothing();
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
	try {
		const { size, width, height, mediaFormat, mediaType, contentTypeString } =
			await getSmartMetadata(media.mediaUrl);
		return {
			url: media.mediaUrl,
			type: mediaType,
			format: mediaFormat,
			contentTypeString,
			fileSize: size,
			width,
			height,
			sources: ['twitter'],
			isPrivate: false,
			needsCuration: true,
			recordCreatedAt: media.tweet.recordCreatedAt,
			recordUpdatedAt: media.tweet.recordUpdatedAt,
			contentCreatedAt: media.tweet.contentCreatedAt,
			contentUpdatedAt: media.tweet.contentUpdatedAt,
		};
	} catch (error) {
		console.error('Error getting smart metadata for media', media.tweetUrl, media.mediaUrl, error);
		return null;
	}
};

export async function createMediaFromTweets() {
	console.log('Creating media from Twitter tweets');
	const mediaWithTweets = await db.query.twitterMedia.findMany({
		where: isNull(twitterMedia.mediaId),
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
			console.log(`Failed to create media for tweet ${item.tweetUrl}: ${item.mediaUrl}`);
			await db.delete(twitterMedia).where(eq(twitterMedia.id, item.id));
			continue;
		}
		console.log(`Creating media for ${mediaItem.url}`);
		const [newMedia] = await db
			.insert(media)
			.values(mediaItem)
			.onConflictDoUpdate({
				target: [media.url],
				set: {
					recordUpdatedAt: new Date(),
				},
			})
			.returning({ id: media.id });
		if (!newMedia) {
			throw new Error('Failed to create media');
		}
		await db.update(twitterMedia).set({ mediaId: newMedia.id }).where(eq(twitterMedia.id, item.id));

		if (item.tweet.recordId) {
			console.log(`Linking media ${newMedia.id} to record ${item.tweet.recordId}`);
			await db
				.insert(recordMedia)
				.values({
					recordId: item.tweet.recordId,
					mediaId: newMedia.id,
				})
				.onConflictDoNothing();
		}
	}
}
