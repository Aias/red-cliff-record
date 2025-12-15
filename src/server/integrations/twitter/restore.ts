import { records } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '../common/logging';
import {
	createUrlResolver,
	loadKnownTweetIds,
	normalizeTweetContent,
	stripUrls,
} from './tweet-text';
import { decodeHtmlEntities } from '@/shared/lib/formatting';

const logger = createIntegrationLogger('twitter', 'restore-records');

export async function restoreTweetRecordLinks() {
	logger.start('Restoring stripped links for Twitter records');

	const knownTweetIds = await loadKnownTweetIds();
	const resolveUrl = createUrlResolver();

	const tweets = await db.query.twitterTweets.findMany({
		where: {
			recordId: { isNotNull: true },
			deletedAt: { isNull: true },
		},
		with: {
			record: true,
			user: true,
		},
	});

	if (tweets.length === 0) {
		logger.skip('No tweets with records found');
		return;
	}

	let updatedCount = 0;

	for (const tweet of tweets) {
		const record = tweet.record;

		if (!record || record.isCurated) {
			continue;
		}

		const decodedText = tweet.text ? decodeHtmlEntities(tweet.text).trim() : '';
		const normalizedContent = await normalizeTweetContent(decodedText, knownTweetIds, resolveUrl);

		if (!normalizedContent) {
			continue;
		}

		const existingContent = record.content?.trim() ?? '';
		if (!existingContent) {
			await db
				.update(records)
				.set({ content: normalizedContent, recordUpdatedAt: new Date() })
				.where(eq(records.id, record.id));
			updatedCount += 1;
			continue;
		}

		const normalizedWithoutUrls = stripUrls(normalizedContent);
		const existingWithoutUrls = stripUrls(existingContent);

		const differsOnlyByUrls =
			normalizedContent !== existingContent && normalizedWithoutUrls === existingWithoutUrls;

		if (!differsOnlyByUrls) {
			continue;
		}

		await db
			.update(records)
			.set({ content: normalizedContent, recordUpdatedAt: new Date() })
			.where(eq(records.id, record.id));

		updatedCount += 1;
	}

	logger.complete(`Restored links for ${updatedCount} record${updatedCount === 1 ? '' : 's'}`);
}
