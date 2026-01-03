#!/usr/bin/env bun
/**
 * Test script for the Twitter client.
 *
 * Fetches bookmarks from the API and writes them to .temp/ for inspection.
 * Does NOT touch the database.
 *
 * Usage:
 *   bun src/server/integrations/twitter/test-client.ts [--max-pages N]
 */

import { createTwitterClient } from './client';
import { writeDebugOutput } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';

const logger = createIntegrationLogger('twitter', 'test');

async function main(): Promise<void> {
	// Parse --max-pages argument
	const maxPagesArg = process.argv.find((arg) => arg.startsWith('--max-pages='));
	const maxPagesIndex = process.argv.indexOf('--max-pages');
	let maxPages: number | undefined;

	if (maxPagesArg) {
		maxPages = parseInt(maxPagesArg.split('=')[1] ?? '1', 10);
	} else if (maxPagesIndex !== -1 && process.argv[maxPagesIndex + 1]) {
		maxPages = parseInt(process.argv[maxPagesIndex + 1] ?? '1', 10);
	} else {
		// Default to 1 page for testing
		maxPages = 1;
	}

	logger.start(`Testing Twitter client (max ${maxPages} page${maxPages === 1 ? '' : 's'})`);

	try {
		const client = createTwitterClient({ timeoutMs: 30000 });

		logger.info('Fetching bookmarks from Twitter API...');
		const bookmarks = await client.fetchAllBookmarks({ maxPages });

		logger.info(`Received ${bookmarks.length} page(s) of bookmarks`);

		// Count total tweets
		let totalTweets = 0;
		for (const page of bookmarks) {
			const instructions = page.response.data.bookmark_timeline_v2.timeline.instructions;
			for (const instruction of instructions) {
				totalTweets += instruction.entries.filter(
					(e) => e.content.__typename !== 'TimelineTimelineCursor'
				).length;
			}
		}
		logger.info(`Total tweets across all pages: ${totalTweets}`);

		// Write to .temp/ for inspection
		const filepath = await writeDebugOutput('twitter-api-test', bookmarks);
		logger.complete(`Test data written to ${filepath}`);

		// Also log a sample tweet to verify structure
		if (bookmarks.length > 0) {
			const firstPage = bookmarks[0];
			const instructions = firstPage?.response.data.bookmark_timeline_v2.timeline.instructions;
			const firstInstruction = instructions?.[0];
			const firstEntry = firstInstruction?.entries.find(
				(e) => e.content.__typename !== 'TimelineTimelineCursor' && e.content.itemContent
			);

			if (firstEntry?.content.itemContent?.tweet_results?.result) {
				const tweet = firstEntry.content.itemContent.tweet_results.result as {
					rest_id?: string;
					legacy?: { full_text?: string };
					core?: { user_results?: { result?: { legacy?: { screen_name?: string } } } };
				};
				logger.info('Sample tweet:');
				logger.info(`  ID: ${tweet.rest_id}`);
				logger.info(
					`  Author: @${tweet.core?.user_results?.result?.legacy?.screen_name ?? 'unknown'}`
				);
				logger.info(`  Text: ${(tweet.legacy?.full_text ?? '').slice(0, 100)}...`);
			}
		}
	} catch (error) {
		logger.error('Test failed', error);
		process.exit(1);
	}
}

void main();
