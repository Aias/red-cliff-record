import { bookmarks } from '@schema/main';
import { IntegrationType, RunType } from '@schema/main/integrations';
import { like } from 'drizzle-orm';
import { createPgConnection } from '@schema/connections';
import { runIntegration } from '@utils/run-integration';
import {
	isTweetWithVisibilityResults,
	formatTweetContent,
	getFirstSentence,
	getFirstImageUrl
} from './helpers';
import { loadBookmarksData } from './loaders';

const db = createPgConnection();

async function processTwitterBookmarks(integrationRunId: number): Promise<number> {
	const data = await loadBookmarksData();
	const bookmarksToInsert: (typeof bookmarks.$inferInsert)[] = [];
	let skippedCount = 0;

	for (const bookmarkResponse of data) {
		const entries = bookmarkResponse.response.data.bookmark_timeline_v2.timeline.instructions
			.flatMap((instruction) => instruction.entries)
			.filter((entry) => entry.content.entryType === 'TimelineTimelineItem');

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

			// Check if this tweet already exists in the database
			const existingBookmark = await db
				.select({ id: bookmarks.id })
				.from(bookmarks)
				.where(like(bookmarks.url, `%${tweet.rest_id}`))
				.limit(1);

			if (existingBookmark.length > 0) {
				skippedCount++;
				continue;
			}

			const tweetContent = formatTweetContent(tweet);
			const url = `https://twitter.com/i/web/status/${tweet.rest_id}`;
			const bookmarkedAt = new Date(tweet.legacy.created_at);

			bookmarksToInsert.push({
				url,
				title: getFirstSentence(tweet.legacy.full_text),
				creator: `${tweet.core.user_results.result.legacy.name} (@${tweet.core.user_results.result.legacy.screen_name})`,
				content: tweetContent,
				notes: null,
				bookmarkedAt,
				type: 'tweet',
				category: 'Microblog',
				tags: [],
				imageUrl: getFirstImageUrl(tweet),
				integrationRunId
			});
		}
	}

	// Insert new bookmarks in chunks
	if (bookmarksToInsert.length > 0) {
		console.log(
			`Inserting ${bookmarksToInsert.length} new bookmarks (skipped ${skippedCount} existing bookmarks)`
		);
		const chunkSize = 100;
		for (let i = 0; i < bookmarksToInsert.length; i += chunkSize) {
			const chunk = bookmarksToInsert.slice(i, i + chunkSize);
			await db.insert(bookmarks).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(bookmarksToInsert.length / chunkSize)}`
			);
		}
		console.log('New bookmark rows inserted.');
	} else {
		console.log(`No new bookmarks to insert (skipped ${skippedCount} existing bookmarks)`);
	}

	return bookmarksToInsert.length;
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
