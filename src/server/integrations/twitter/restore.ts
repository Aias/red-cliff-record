import { records } from '@hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { decodeHtmlEntities } from '@/shared/lib/formatting';
import { createIntegrationLogger } from '../common/logging';
import {
  createUrlResolver,
  loadKnownTweetIds,
  normalizeTweetContent,
  stripUrls,
} from './tweet-text';

const logger = createIntegrationLogger('twitter', 'restore-records');

interface RestoreOptions {
  dryRun?: boolean;
  limit?: number;
}

const DEV_SERVER_URL = 'http://localhost:5173';

interface PendingChange {
  recordId: number;
  tweetId: string;
  tweetUrl: string;
  reason: 'empty' | 'url-restoration';
  before: string;
  after: string;
  addedUrls: string[];
}

const truncate = (text: string, maxLength = 100): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
};

const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

/** Extract URLs that are in `after` but not in `before` */
const findAddedUrls = (before: string, after: string): string[] => {
  const beforeUrls = new Set(before.match(URL_PATTERN) ?? []);
  const afterUrls = after.match(URL_PATTERN) ?? [];
  return afterUrls.filter((url) => !beforeUrls.has(url));
};

const timestamp = (): string => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
};

interface ProgressStats {
  emptyFills: number;
  urlRestorations: number;
  skippedEdited: number;
  skippedNoChange: number;
  skippedNoContent: number;
}

export async function restoreTweetRecordLinks(options: RestoreOptions = {}) {
  const { dryRun = false, limit } = options;

  const modeLabel = dryRun ? '[DRY RUN] ' : '';
  const limitLabel = limit ? ` (limit: ${limit})` : '';
  logger.start(`${modeLabel}Analyzing Twitter records${limitLabel}`);

  const knownTweetIds = await loadKnownTweetIds();
  const resolveUrl = createUrlResolver();

  const allTweets = await db.query.twitterTweets.findMany({
    where: {
      recordId: { isNotNull: true },
      deletedAt: { isNull: true },
    },
    with: {
      record: true,
    },
  });

  if (allTweets.length === 0) {
    logger.skip('No tweets with records found');
    return;
  }

  const tweets = limit ? allTweets.slice(0, limit) : allTweets;
  const total = tweets.length;
  const totalAvailable = allTweets.length;

  if (limit && limit < totalAvailable) {
    logger.info(`Scanning ${total} of ${totalAvailable} tweets (limited)...`);
  } else {
    logger.info(`Scanning ${total} tweets with records...`);
  }

  const pendingChanges: PendingChange[] = [];
  const stats: ProgressStats = {
    emptyFills: 0,
    urlRestorations: 0,
    skippedEdited: 0,
    skippedNoChange: 0,
    skippedNoContent: 0,
  };
  let processed = 0;

  const PROGRESS_INTERVAL = 100;

  const logProgress = () => {
    const percent = Math.round((processed / total) * 100);
    const willUpdate = stats.emptyFills + stats.urlRestorations;
    const skipped = stats.skippedEdited + stats.skippedNoChange + stats.skippedNoContent;
    console.log(
      `[${timestamp()}] Progress: ${processed}/${total} (${percent}%) | ` +
        `Will update: ${willUpdate} (${stats.emptyFills} empty, ${stats.urlRestorations} restore) | ` +
        `Skipped: ${skipped}`
    );
  };

  for (const tweet of tweets) {
    processed += 1;

    const record = tweet.record;

    if (!record) {
      continue;
    }

    const decodedText = tweet.text ? decodeHtmlEntities(tweet.text).trim() : '';
    // Include quoted tweet ID so its URL gets removed (relationship is tracked separately)
    const additionalKnownIds = tweet.quotedTweetId ? [tweet.quotedTweetId] : [];
    const normalizedContent = await normalizeTweetContent(decodedText, knownTweetIds, resolveUrl, {
      additionalKnownIds,
    });

    if (!normalizedContent) {
      stats.skippedNoContent += 1;
      if (processed % PROGRESS_INTERVAL === 0) logProgress();
      continue;
    }

    const existingContent = record.content?.trim() ?? '';
    const tweetUrl = `https://x.com/i/status/${tweet.id}`;

    // Case 1: Record has no content, fill it in
    if (!existingContent) {
      pendingChanges.push({
        recordId: record.id,
        tweetId: tweet.id,
        tweetUrl,
        reason: 'empty',
        before: '(empty)',
        after: normalizedContent,
        addedUrls: findAddedUrls('', normalizedContent),
      });
      stats.emptyFills += 1;
      if (processed % PROGRESS_INTERVAL === 0) logProgress();
      continue;
    }

    // Case 2: Content differs only by URLs (restore stripped links)
    // This handles both curated and non-curated records — if the non-URL text
    // has been edited, we skip; if only URLs differ, we restore them.
    const normalizedWithoutUrls = stripUrls(normalizedContent);
    const existingWithoutUrls = stripUrls(existingContent);

    const differsOnlyByUrls =
      normalizedContent !== existingContent && normalizedWithoutUrls === existingWithoutUrls;

    if (!differsOnlyByUrls) {
      // Content has been edited (non-URL text differs) or is already correct
      if (normalizedContent !== existingContent) {
        stats.skippedEdited += 1;
      } else {
        stats.skippedNoChange += 1;
      }
      if (processed % PROGRESS_INTERVAL === 0) logProgress();
      continue;
    }

    const addedUrls = findAddedUrls(existingContent, normalizedContent);

    // Only include if there are actually URLs being added
    // (skip whitespace-only differences)
    if (addedUrls.length === 0) {
      stats.skippedNoChange += 1;
      if (processed % PROGRESS_INTERVAL === 0) logProgress();
      continue;
    }

    pendingChanges.push({
      recordId: record.id,
      tweetId: tweet.id,
      tweetUrl,
      reason: 'url-restoration',
      before: existingContent,
      after: normalizedContent,
      addedUrls,
    });
    stats.urlRestorations += 1;

    // Log progress every N tweets
    if (processed % PROGRESS_INTERVAL === 0) logProgress();
  }

  // Final progress
  logProgress();

  // Report findings
  console.log('');
  logger.info('─'.repeat(60));
  logger.info('SUMMARY');
  logger.info('─'.repeat(60));
  logger.info(`Total tweets scanned: ${total}`);
  logger.info('');
  logger.info('Will update:');
  logger.info(`  ${stats.emptyFills} empty records to fill`);
  logger.info(`  ${stats.urlRestorations} records with URLs to restore`);
  logger.info('');
  logger.info('Skipped:');
  logger.info(`  ${stats.skippedNoChange} already correct (no changes needed)`);
  logger.info(`  ${stats.skippedEdited} manually edited (text differs)`);
  logger.info(`  ${stats.skippedNoContent} tweets with no content`);
  logger.info('─'.repeat(60));

  if (pendingChanges.length === 0) {
    logger.complete('No records need updating');
    return;
  }

  if (dryRun) {
    // Show detailed changes in dry run mode
    console.log('\n' + '─'.repeat(80));
    console.log('PROPOSED CHANGES');
    console.log('─'.repeat(80) + '\n');

    for (const change of pendingChanges) {
      const label = change.reason === 'empty' ? 'FILL EMPTY' : 'RESTORE URLs';
      console.log(`[${label}] Record #${change.recordId}`);
      console.log(`  Local:  ${DEV_SERVER_URL}/records/${change.recordId}`);
      console.log(`  Tweet:  ${change.tweetUrl}`);
      if (change.addedUrls.length > 0) {
        console.log(`  Adding: ${change.addedUrls.join(', ')}`);
      }
      console.log(`  Before: ${truncate(change.before)}`);
      console.log(`  After:  ${truncate(change.after)}`);
      console.log('');
    }

    console.log('─'.repeat(80));
    console.log('QUICK LINKS (copy to browser):');
    console.log('─'.repeat(80));
    for (const change of pendingChanges) {
      console.log(`${DEV_SERVER_URL}/records/${change.recordId}`);
    }
    console.log('─'.repeat(80));
    console.log(`\nDRY RUN COMPLETE - No changes made. Run without --dry-run to apply.`);
    console.log('─'.repeat(80) + '\n');
    return;
  }

  // Apply changes
  let updatedCount = 0;
  for (const change of pendingChanges) {
    await db
      .update(records)
      .set({ content: change.after, recordUpdatedAt: new Date() })
      .where(eq(records.id, change.recordId));
    updatedCount += 1;
  }

  logger.complete(`Restored links for ${updatedCount} record${updatedCount === 1 ? '' : 's'}`);
}
