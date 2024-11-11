import type { TwitterBookmarksArray, Tweet } from './types';
import {
	bookmarks,
	integrationRuns,
	IntegrationType,
	IntegrationStatus,
	RunType
} from '../../schema/main';
import { eq, inArray } from 'drizzle-orm';
import { createPgConnection } from '../../connections';

const db = createPgConnection();

function getFirstImageUrl(tweet: Tweet): string | null {
	// Check extended_entities first, then entities
	const media = tweet.legacy.extended_entities?.media || tweet.legacy.entities.media;
	if (!media?.length) return null;

	return media[0].media_url_https;
}

function getFirstSentence(text: string): string {
	// Get first line if there are line breaks
	if (text.includes('\n')) {
		return text.split('\n')[0];
	}

	// Otherwise get first sentence or full text if no sentence end found
	const match = text.match(/^[^.!?]+[.!?]/);
	return match ? match[0] : text;
}

function formatTweetContent(tweet: Tweet): string {
	let content = tweet.legacy.full_text;

	// Add quoted tweet if exists
	if (tweet.quoted_status_result) {
		const quotedTweet = tweet.quoted_status_result.result;
		const quotedAuthor = quotedTweet.core.user_results.result.legacy.name;
		const quotedText = quotedTweet.legacy.full_text;

		content = `${content}\n\n> ${quotedText}\n> — ${quotedAuthor}`;
	}

	return content;
}

async function seedTwitterBookmarks(bookmarksData: TwitterBookmarksArray) {
	// Create integration run
	const run = await db
		.insert(integrationRuns)
		.values({
			integrationType: IntegrationType.TWITTER,
			runType: RunType.FULL,
			runStartTime: new Date()
		})
		.returning();

	if (run.length === 0) {
		console.error('Could not create integration run.');
		return;
	}
	console.log(`Created integration run with id ${run[0].id}`);

	try {
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

		const bookmarksToInsert = [];

		for (const bookmarkResponse of bookmarksData) {
			const bookmarkedAt = new Date(bookmarkResponse.timestamp);

			const entries =
				bookmarkResponse.response.data.bookmark_timeline_v2.timeline.instructions.flatMap(
					(instruction) => instruction.entries
				);

			for (const entry of entries) {
				const tweet = entry.content.itemContent.tweet_results.result;
				const tweetContent = formatTweetContent(tweet);

				bookmarksToInsert.push({
					url: `https://twitter.com/i/web/status/${tweet.rest_id}`,
					title: getFirstSentence(tweet.legacy.full_text),
					content: tweetContent,
					notes: null,
					type: 'tweet',
					category: 'tweet',
					tags: [],
					starred: false,
					imageUrl: getFirstImageUrl(tweet),
					integrationRunId: run[0].id,
					createdAt: bookmarkedAt
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

		// Update integration run status
		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.SUCCESS,
				runEndTime: new Date(),
				entriesCreated: bookmarksToInsert.length
			})
			.where(eq(integrationRuns.id, run[0].id));
		console.log(`Updated integration run with id ${run[0].id}`);
	} catch (err) {
		console.error('Error inserting Twitter bookmarks:', err);
		await db
			.update(integrationRuns)
			.set({ status: IntegrationStatus.FAIL, runEndTime: new Date() })
			.where(eq(integrationRuns.id, run[0].id));
		console.error(`Updated integration run with id ${run[0].id} to failed`);
	}
}

// Export for use in other files
export { seedTwitterBookmarks };
