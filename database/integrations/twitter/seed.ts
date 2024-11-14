import { bookmarks } from '@schema/main';
import { integrationRuns, IntegrationType } from '@schema/main/integrations';
import { eq, inArray } from 'drizzle-orm';
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
