import { readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';
import { db } from '~/server/db/connections';
import {
	twitterMedia as mediaTable,
	twitterTweets as tweetsTable,
	twitterUsers as usersTable,
	type TwitterMediaInsert,
	type TwitterTweetInsert,
	type TwitterUserInsert,
} from '~/server/db/schema/integrations';
import { runIntegration } from '../common/run-integration';
import { processMedia, processTweet, processUser } from './helpers';
import type { Tweet, TweetData, TwitterBookmarksArray } from './types';

export async function loadBookmarksData(): Promise<TwitterBookmarksArray> {
	const twitterDataDir = resolve(homedir(), 'Documents/Red Cliff Record/Twitter Data');

	try {
		// Read the directory entries with file types.
		const entries = readdirSync(twitterDataDir, { withFileTypes: true });
		// Filter for files that start with "bookmarks-" and end with ".json"
		const bookmarkFiles = entries
			.filter(
				(entry) =>
					entry.isFile() && entry.name.startsWith('bookmarks-') && entry.name.endsWith('.json')
			)
			.map((entry) => entry.name)
			.sort(); // Ascending order since the filenames are in ISO format

		if (bookmarkFiles.length === 0) {
			console.log('No Twitter bookmarks files found. Skipping Twitter bookmark sync.');
			return [];
		}

		const combinedData: TwitterBookmarksArray = [];
		// Process each file in ascending order
		for (const fileName of bookmarkFiles) {
			const filePath = resolve(twitterDataDir, fileName);
			console.log(`Processing Twitter bookmarks file: ${filePath}`);
			const fileContent = readFileSync(filePath, 'utf-8');
			// Assuming each JSON file parses into an array of bookmark responses
			const parsedData = JSON.parse(fileContent);
			combinedData.push(...parsedData);
		}

		return combinedData;
	} catch (err) {
		if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
			console.log(`Twitter data directory not found at: ${twitterDataDir}`);
			return [];
		}
		// If it's any other error (e.g. issues with JSON parsing), we throw
		console.error('Error loading Twitter bookmarks data:', err);
		throw err;
	}
}

const filteredTypes = ['TimelineTimelineCursor', 'TweetTombstone'];

async function syncTwitterBookmarks(integrationRunId: number): Promise<number> {
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

	const processedUsers: TwitterUserInsert[] = [];
	const processedMedia: TwitterMediaInsert[] = [];
	const processedTweets: TwitterTweetInsert[] = [];
	const processedQuoteTweets: TwitterTweetInsert[] = [];

	tweets.forEach((t) => {
		const tweet = processTweet(t);
		if (tweet.quotedTweetId) {
			processedQuoteTweets.push({ ...tweet, integrationRunId });
		} else {
			processedTweets.push({ ...tweet, integrationRunId });
		}
		const user = processUser(t.core.user_results.result);
		processedUsers.push({ ...user, integrationRunId });
		t.legacy.entities.media?.forEach((m) => {
			const mediaData = processMedia(m, t);
			processedMedia.push({ ...mediaData });
		});
	});

	return await db.transaction(
		async (tx) => {
			// 1. Insert Users
			console.log(`Inserting ${processedUsers.length} users...`);
			processedUsers.forEach(async (user) => {
				await tx
					.insert(usersTable)
					.values(user)
					.onConflictDoUpdate({
						target: [usersTable.id],
						set: {
							...user,
							updatedAt: new Date(),
						},
					});
			});

			// 2. Insert Regular Tweets
			console.log(`Inserting ${processedTweets.length} regular tweets...`);
			processedTweets.forEach(async (tweet) => {
				await tx
					.insert(tweetsTable)
					.values(tweet)
					.onConflictDoUpdate({
						target: tweetsTable.id,
						set: { ...tweet, updatedAt: new Date() },
					});
			});

			// 3. Insert Quoted Tweets
			console.log(`Inserting ${processedQuoteTweets.length} tweets with quotes...`);
			processedQuoteTweets.forEach(async (tweet) => {
				await tx
					.insert(tweetsTable)
					.values(tweet)
					.onConflictDoUpdate({
						target: tweetsTable.id,
						set: { ...tweet, updatedAt: new Date() },
					});
			});

			// 4. Insert Media
			console.log(`Inserting ${processedMedia.length} media items...`);
			processedMedia.forEach(async (mediaItem) => {
				await tx
					.insert(mediaTable)
					.values(mediaItem)
					.onConflictDoUpdate({
						target: mediaTable.id,
						set: { ...mediaItem, updatedAt: new Date() },
					});
			});

			const totalTweets = processedTweets.length + processedQuoteTweets.length;
			console.log(`Successfully processed ${totalTweets} tweets`);
			return totalTweets;
		},
		{
			isolationLevel: 'read committed',
		}
	);
}

const main = async () => {
	try {
		await runIntegration('twitter', syncTwitterBookmarks);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncTwitterBookmarks };
