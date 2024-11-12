import type { TwitterBookmarksArray, Tweet, TweetWithVisibilityResults, TweetTombstone } from './types';
import {
	bookmarks,
	integrationRuns,
	IntegrationType
} from '../../schema/main';
import { eq, inArray } from 'drizzle-orm';
import { createPgConnection } from '../../connections';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runIntegration } from '../utils/run-integration';

const db = createPgConnection();

function getFirstImageUrl(tweet: Tweet): string | null {
	const media = tweet.legacy.extended_entities?.media || tweet.legacy.entities.media;
	if (!media?.length) return null;
	return media[0].media_url_https;
}

function getFirstSentence(text: string): string {
	if (text.includes('\n')) {
		return text.split('\n')[0];
	}
	const match = text.match(/^[^.!?]+[.!?]/);
	return match ? match[0] : text;
}

// Add type guard
function isTweetWithVisibilityResults(tweet: Tweet | TweetWithVisibilityResults): tweet is TweetWithVisibilityResults {
	return tweet.__typename === 'TweetWithVisibilityResults';
}

function isTweetTombstone(tweet: Tweet | TweetTombstone): tweet is TweetTombstone {
	return tweet.__typename === 'TweetTombstone';
}

function formatTweetContent(tweet: Tweet): string {
	let content = tweet.legacy.full_text;

	if (tweet.quoted_status_result?.result) {
			const quotedResult = tweet.quoted_status_result.result;
			
			// Handle tombstones first
			if (isTweetTombstone(quotedResult)) {
					content = `${content}\n\n> [${quotedResult.tombstone.text.text}]`;
			} else {					
					// Handle normal quoted tweets
					if (quotedResult.__typename === "Tweet") {
							const tweetResult = quotedResult as Tweet;
							if (tweetResult.legacy?.full_text) {
									const quotedAuthor = tweetResult.core?.user_results?.result?.legacy?.name || 'Unknown Author';
									const quotedText = tweetResult.legacy.full_text;
									content = `> "${quotedText}" — ${quotedAuthor}\n\n${content}`;
							}
					} else {
							const tweetResult = quotedResult as Tweet;
							console.log('Quoted tweet has incomplete data:', {
									tweetId: tweet.rest_id,
									quotedTweetId: tweetResult.rest_id,
									quotedTweetType: tweetResult.__typename,
									hasLegacy: 'legacy' in tweetResult && !!tweetResult.legacy,
									hasFullText: 'legacy' in tweetResult && !!tweetResult.legacy?.full_text,
									quotedTweet: tweetResult
							});
					}
			}
	}

	return content;
}

async function loadBookmarksData(): Promise<TwitterBookmarksArray> {
	const defaultPath = resolve(process.cwd(), '.temp/bookmark-responses.json');
	try {
		const data = readFileSync(defaultPath, 'utf-8');
		return JSON.parse(data);
	} catch (err) {
		console.error('Error loading Twitter bookmarks data:', err);
		throw err;
	}
}

async function processTwitterBookmarks(integrationRunId: number): Promise<number> {
	const data = await loadBookmarksData();
	const bookmarksToInsert: typeof bookmarks.$inferInsert[] = [];

	// Delete existing Twitter bookmarks
	console.log('Deleting existing Twitter bookmarks.');
	await db
		.delete(bookmarks)
		.where(
			inArray(
				bookmarks.integrationRunId,
				db
					.select({ id: integrationRuns.id })
					.from(integrationRuns)
					.where(eq(integrationRuns.integrationType, IntegrationType.TWITTER))
			)
		);
	console.log('Twitter bookmarks deleted.');

	for (const bookmarkResponse of data) {
		const entries = bookmarkResponse.response.data.bookmark_timeline_v2.timeline.instructions.flatMap(
			(instruction) => instruction.entries
			).filter(entry => entry.content.entryType === "TimelineTimelineItem");

		for (const entry of entries) {
			if (!entry?.content?.itemContent?.tweet_results?.result) {
				console.log('Skipping invalid tweet entry:', entry);
				continue;
			}

			let tweet = entry.content.itemContent.tweet_results.result;
			
			// Handle TweetWithVisibilityResults type
			if (isTweetWithVisibilityResults(tweet)) {
				tweet = tweet.tweet;
			}

			if (!tweet?.legacy?.full_text) {
				console.log('Skipping tweet without legacy data:', tweet);
				continue;
			}

			const tweetContent = formatTweetContent(tweet);
			
			// Use tweet's creation date
			const bookmarkedAt = new Date(tweet.legacy.created_at);

			bookmarksToInsert.push({
				url: `https://twitter.com/i/web/status/${tweet.rest_id}`,
				title: getFirstSentence(tweet.legacy.full_text),
				creator: `${tweet.core.user_results.result.legacy.name} (@${tweet.core.user_results.result.legacy.screen_name})`,
				content: tweetContent,
				notes: null,
				bookmarkedAt,
				type: 'tweet',
				category: 'Microblog',
				tags: [],
				imageUrl: getFirstImageUrl(tweet),
				integrationRunId,
			});
		}
	}

	// Insert bookmarks in chunks
	console.log(`Inserting ${bookmarksToInsert.length} rows into bookmarks`);
	const chunkSize = 100;
	for (let i = 0; i < bookmarksToInsert.length; i += chunkSize) {
		const chunk = bookmarksToInsert.slice(i, i + chunkSize);
		await db.insert(bookmarks).values(chunk);
		console.log(
			`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(bookmarksToInsert.length / chunkSize)}`
		);
	}
	console.log('Bookmark rows inserted.');

	return bookmarksToInsert.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.TWITTER, processTwitterBookmarks);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed.ts')) {
	main();
}

export { main as seedTwitterBookmarks };
