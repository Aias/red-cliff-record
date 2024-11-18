import {
	tweets as tweetsTable,
	media as mediaTable,
	users as usersTable
} from '@schema/main/twitter';
import { IntegrationType, RunType } from '@schema/main/integrations';
import { createPgConnection } from '@schema/connections';
import { runIntegration } from '@utils/run-integration';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { Tweet, TweetData, TwitterBookmarksArray } from './types';
import { processUser, processTweet, processMedia } from './helpers';

const db = createPgConnection();

export async function loadBookmarksData(): Promise<TwitterBookmarksArray> {
	const defaultPath = resolve(process.cwd(), '.temp/bookmark-responses.json');
	try {
		const data = readFileSync(defaultPath, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		console.error('Error loading Twitter bookmarks data:', err);
		throw err;
	}
}

type ProcessedTweet = ReturnType<typeof processTweet>;
type ProcessedUser = ReturnType<typeof processUser>;
type ProcessedMedia = ReturnType<typeof processMedia>;

const filteredTypes = ['TimelineTimelineCursor', 'TweetTombstone'];

async function processTwitterBookmarks(integrationRunId: number): Promise<number> {
	const bookmarkResponses = await loadBookmarksData();
	const tweets: TweetData[] = [];

	const rawTweets = bookmarkResponses
		.flatMap((group) =>
			group.response.data.bookmark_timeline_v2.timeline.instructions.flatMap((i) => i.entries)
		)
		.map((entry) => entry.content)
		.filter((item) => !filteredTypes.includes(item.__typename))
		.map((item) => {
			const result = item.itemContent.tweet_results.result;
			return result.__typename === 'TweetWithVisibilityResults'
				? { __typename: 'TweetWithVisibilityResults', ...result.tweet }
				: (result as Tweet);
		});

	rawTweets.forEach((tweet) => {
		const { quoted_status_result: quotedTweet, ...mainTweet } = tweet;
		if (quotedTweet?.result) {
			const quotedResult = quotedTweet.result;
			if (filteredTypes.includes(quotedResult.__typename)) return;
			if (quotedResult.__typename === 'TweetWithVisibilityResults') {
				tweets.push({ ...quotedResult.tweet, isQuoted: true });
				tweets.push({ ...mainTweet, quotedTweetId: quotedResult.tweet.rest_id });
			} else {
				tweets.push({ ...quotedResult, isQuoted: true });
				tweets.push({ ...mainTweet, quotedTweetId: quotedResult.rest_id });
			}
		} else {
			tweets.push(mainTweet);
		}
	});

	const processedUsers: ProcessedUser[] = [];
	const processedMedia: ProcessedMedia[] = [];
	const processedTweets: ProcessedTweet[] = [];
	const processedQuoteTweets: ProcessedTweet[] = [];

	tweets.forEach((t) => {
		const tweet = processTweet(t);
		if (tweet.quotedTweetId) {
			processedQuoteTweets.push(tweet);
		} else {
			processedTweets.push(tweet);
		}
		const user = processUser(t.core.user_results.result);
		processedUsers.push(user);
		t.legacy.entities.media?.forEach((m) => {
			const mediaData = processMedia(m, t);
			processedMedia.push(mediaData);
		});
	});

	// 1. Insert Users
	console.log(`Inserting ${processedUsers.length} users...`);
	for (const user of processedUsers) {
		await db
			.insert(usersTable)
			.values({
				id: user.id,
				username: user.username,
				displayName: user.displayName,
				description: user.description,
				location: user.location,
				url: user.twitterUrl,
				externalUrl: user.userExternalLink?.expanded_url,
				profileImageUrl: user.profileImageUrl,
				profileBannerUrl: user.profileBannerUrl
			})
			.onConflictDoNothing({ target: usersTable.id });
	}

	// 2. Insert Regular Tweets
	console.log(`Inserting ${processedTweets.length} regular tweets...`);
	for (const tweet of processedTweets) {
		await db
			.insert(tweetsTable)
			.values({
				id: tweet.id,
				userId: tweet.userId,
				text: tweet.text,
				quotedTweetId: tweet.quotedTweetId,
				integrationRunId: integrationRunId,
				bookmarkedAt: new Date(tweet.createdAt)
			})
			.onConflictDoNothing({ target: tweetsTable.id });
	}

	// 3. Insert Quoted Tweets
	console.log(`Inserting ${processedQuoteTweets.length} tweets with quotes...`);
	for (const tweet of processedQuoteTweets) {
		await db
			.insert(tweetsTable)
			.values({
				id: tweet.id,
				userId: tweet.userId,
				text: tweet.text,
				quotedTweetId: tweet.quotedTweetId,
				integrationRunId: integrationRunId,
				bookmarkedAt: new Date(tweet.createdAt)
			})
			.onConflictDoNothing({ target: tweetsTable.id });
	}

	// 4. Insert Media
	console.log(`Inserting ${processedMedia.length} media items...`);
	for (const mediaItem of processedMedia) {
		await db
			.insert(mediaTable)
			.values({
				id: mediaItem.id,
				type: mediaItem.type,
				url: mediaItem.shortUrl,
				mediaUrl: mediaItem.mediaUrl,
				tweetId: mediaItem.tweetId
			})
			.onConflictDoNothing({ target: mediaTable.id });
	}

	const totalTweets = processedTweets.length + processedQuoteTweets.length;
	console.log(`Successfully processed ${totalTweets} tweets`);
	return totalTweets;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.TWITTER, processTwitterBookmarks, RunType.INCREMENTAL);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./update.ts')) {
	main();
}

export { main as updateTwitterBookmarks };