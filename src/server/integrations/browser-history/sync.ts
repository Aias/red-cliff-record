import os from 'os';
import readline from 'readline';
import { urls, visits } from '@rcr/data/arc';
import type * as browserHistorySchema from '@rcr/data/browser-history';
import {
	browsingHistory,
	type Browser,
	type BrowsingHistoryInsert,
} from '@rcr/data/browser-history';
import { and, eq, gt, isNotNull, ne, notLike, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import {
	CHROME_EPOCH_TO_UNIX_SECONDS,
	chromeEpochMicrosecondsToDatetime,
	collapseSequentialVisits,
	createDailyVisitsQuery,
} from './helpers';
import {
	BrowserNotInstalledError,
	DailyVisitsQueryResultSchema,
	type BrowserConfig,
} from './types';

const logger = createIntegrationLogger('browser-history', 'sync');

/**
 * Configuration constants
 */
const MAX_URL_LENGTH = 1000; // Maximum acceptable URL length
const BATCH_SIZE = 100; // Number of history entries to insert at once

/**
 * List of query parameters that are likely not critical for history purposes
 * These will be removed when sanitizing long URLs
 */
const REMOVABLE_QUERY_PARAMS = [
	'access_token',
	'as',
	'audience',
	'client_id',
	'code',
	'code_challenge',
	'code_challenge_method',
	'connection',
	'consent_verifier',
	'continue',
	'cst',
	'k',
	'login_challenge',
	'login_verifier',
	'nonce',
	'redirect_uri',
	'refresh_token',
	'response_type',
	'scope',
	'sidt',
	'state',
	'TL',
	'upn',
];

/**
 * Creates a readline interface for user input
 *
 * @returns A readline interface
 */
const createPrompt = (): readline.Interface => {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
};

/**
 * Asks the user for confirmation
 *
 * @param message - The message to display to the user
 * @returns Promise that resolves to true if the user confirms, false otherwise
 */
const askForConfirmation = async (message: string): Promise<boolean> => {
	const rl = createPrompt();

	return new Promise((resolve) => {
		rl.question(`${message} (y/N) `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === 'y');
		});
	});
};

/**
 * Sanitizes a URL by removing non-critical query parameters
 *
 * This function attempts to shorten URLs that exceed the maximum length
 * by removing query parameters that are typically not essential for
 * history purposes.
 *
 * @param url - The URL to sanitize
 * @returns The sanitized URL, or null if it's still too long
 */
function sanitizeUrl(url: string): string | null {
	// If URL is already within acceptable length, return it as is
	if (url.length <= MAX_URL_LENGTH) return url;

	try {
		const parsed = new URL(url);

		// Remove non-critical query parameters
		for (const param of REMOVABLE_QUERY_PARAMS) {
			parsed.searchParams.delete(param);
		}

		const sanitized = parsed.toString();

		// Check if the sanitized URL is now within acceptable length
		if (sanitized.length <= MAX_URL_LENGTH) {
			return sanitized;
		} else {
			return null; // Still too long
		}
	} catch (error) {
		logger.warn('Failed to parse URL, excluding record: ' + url, error);
		return null;
	}
}

/**
 * Synchronizes browser history with the database
 *
 * This function:
 * 1. Checks if the current hostname is known
 * 2. Retrieves the most recent history entry
 * 3. Fetches new history entries
 * 4. Processes and sanitizes the entries
 * 5. Inserts them into the database
 *
 * @param browserConfig - The browser configuration
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of history entries inserted
 * @throws Error if synchronization fails
 */
async function syncBrowserHistory(
	browserConfig: BrowserConfig,
	integrationRunId: number,
	collectDebugData?: unknown[]
): Promise<number> {
	try {
		// Get current hostname
		const currentHostname = os.hostname();

		// Step 1: Check if the current hostname is known
		const shouldProceed = await checkHostname(currentHostname, browserConfig.name);
		if (!shouldProceed) {
			logger.info('Sync cancelled by user');
			return 0;
		}

		logger.start(`Starting ${browserConfig.displayName} browser history incremental update`);

		// Step 2: Get the most recent history entry
		const lastKnownTime = await getLastSyncPoint(currentHostname, browserConfig.name);
		logLastSyncPoint(lastKnownTime);

		// Step 3: Fetch new history entries
		logger.info('Retrieving new history entries...');
		const browserDb = browserConfig.createConnection();

		// Calculate effective cutoff time (use the later of lastKnownTime or browser cutoff date)
		let effectiveCutoff = lastKnownTime;
		if (browserConfig.cutoffDate) {
			const cutoffMicroseconds = BigInt(
				(browserConfig.cutoffDate.getTime() + CHROME_EPOCH_TO_UNIX_SECONDS * 1000) * 1000
			);
			if (!effectiveCutoff || cutoffMicroseconds > effectiveCutoff) {
				effectiveCutoff = cutoffMicroseconds;
				logger.info(`Using browser cutoff date: ${browserConfig.cutoffDate.toISOString()}`);
			}
		}

		const rawHistory = await fetchNewHistoryEntries(browserDb, effectiveCutoff);
		logger.info(`Retrieved ${rawHistory.length} new history entries`);

		// Collect debug data if requested
		if (collectDebugData) {
			collectDebugData.push(...rawHistory);
		}

		// Step 4: Process and sanitize the entries
		const processedHistory = processHistoryEntries(
			rawHistory,
			currentHostname,
			integrationRunId,
			browserConfig.name
		);

		// Step 5: Insert the entries into the database
		if (processedHistory.length > 0) {
			await insertHistoryEntries(processedHistory);
		} else {
			logger.info('No new history entries to insert');
		}

		return processedHistory.length;
	} catch (error) {
		if (error instanceof BrowserNotInstalledError) {
			throw error;
		}
		logger.error(`Error syncing ${browserConfig.displayName} browser history`, error);
		throw new Error(
			`Failed to sync ${browserConfig.displayName} browser history: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}

/**
 * Checks if the current hostname is known and asks for confirmation if not
 *
 * @param currentHostname - The current hostname
 * @param browser - The browser type
 * @returns Promise that resolves to true if the sync should proceed, false otherwise
 */
async function checkHostname(currentHostname: string, _browser: Browser): Promise<boolean> {
	// Get all unique hostnames from the database
	const uniqueHostnames = await db
		.select({
			hostname: browsingHistory.hostname,
		})
		.from(browsingHistory)
		// .where(eq(browsingHistory.browser, browser))
		.groupBy(browsingHistory.hostname);

	const knownHostnames = new Set(uniqueHostnames.map((h) => h.hostname));

	// If current hostname is not in the database, ask for confirmation
	if (!knownHostnames.has(currentHostname)) {
		logger.info('Known hostnames: ' + Array.from(knownHostnames).join(', '));
		return askForConfirmation(
			`Current hostname "${currentHostname}" has not been seen before. Proceed with sync?`
		);
	}

	return true;
}

/**
 * Gets the timestamp of the most recent history entry
 *
 * @param hostname - The hostname to check
 * @param browser - The browser type
 * @returns The timestamp of the most recent entry, or null if none exists
 */
async function getLastSyncPoint(hostname: string, browser: Browser): Promise<bigint | null> {
	const latestVisit = await db.query.browsingHistory.findFirst({
		columns: {
			viewEpochMicroseconds: true,
		},
		where: {
			browser: browser,
			hostname: hostname,
			viewEpochMicroseconds: {
				isNotNull: true,
			},
		},
		orderBy: {
			viewEpochMicroseconds: 'desc',
		},
	});

	return latestVisit?.viewEpochMicroseconds ?? null;
}

/**
 * Logs information about the last sync point
 *
 * @param lastKnownTime - The timestamp of the most recent entry
 */
function logLastSyncPoint(lastKnownTime: bigint | null): void {
	if (lastKnownTime) {
		const date = chromeEpochMicrosecondsToDatetime(lastKnownTime);
		logger.info(`Last known visit time: ${date.toLocaleString()} (${date.toISOString()})`);
	} else {
		logger.info('Last known visit time: none');
	}
}

/**
 * Fetches new history entries from the database
 *
 * @param browserDb - The browser database connection
 * @param lastKnownTime - The timestamp of the most recent entry
 * @returns Array of new history entries
 */
async function fetchNewHistoryEntries(
	browserDb: LibSQLDatabase<typeof browserHistorySchema>,
	lastKnownTime: bigint | null
) {
	const dailyVisitsQuery = createDailyVisitsQuery(browserDb);
	return dailyVisitsQuery.where(
		and(
			notLike(urls.url, 'chrome-extension://%'),
			notLike(urls.url, 'chrome://%'),
			notLike(urls.url, 'about:%'),
			isNotNull(urls.url),
			isNotNull(urls.title),
			ne(urls.title, ''),
			ne(urls.url, ''),
			lastKnownTime ? gt(visits.visitTime, Number(lastKnownTime)) : undefined
		)
	);
}

/**
 * Processes and sanitizes history entries
 *
 * @param rawHistory - The raw history entries
 * @param hostname - The current hostname
 * @param integrationRunId - The ID of the current integration run
 * @param browser - The browser type
 * @returns Array of processed history entries
 */
function processHistoryEntries(
	rawHistory: unknown[],
	hostname: string,
	integrationRunId: number,
	browser: Browser
): BrowsingHistoryInsert[] {
	// Parse and validate the history data
	const dailyHistory = DailyVisitsQueryResultSchema.parse(rawHistory);

	// Collapse sequential visits to the same URL
	const collapsedHistory = collapseSequentialVisits(dailyHistory);
	logger.info(`Collapsed into ${collapsedHistory.length} entries`);

	// Convert to database format
	const history: BrowsingHistoryInsert[] = collapsedHistory.map((h) => ({
		browser: browser,
		hostname: hostname,
		viewTime: chromeEpochMicrosecondsToDatetime(h.viewTime),
		viewEpochMicroseconds: BigInt(h.viewTime),
		viewDuration: h.viewDuration ? Math.round(h.viewDuration / 1000000) : 0,
		durationSinceLastView: h.durationSinceLastView
			? Math.round(h.durationSinceLastView / 1000000)
			: 0,
		url: h.url,
		pageTitle: h.pageTitle,
		searchTerms: h.searchTerms,
		relatedSearches: h.relatedSearches,
		integrationRunId,
	}));

	// Sanitize URLs
	const processedHistory: BrowsingHistoryInsert[] = [];
	for (const h of history) {
		const sanitizedUrl = sanitizeUrl(h.url);
		if (sanitizedUrl === null) {
			continue; // Skip entries with URLs that are too long
		}
		processedHistory.push({
			...h,
			url: sanitizedUrl,
		});
	}

	return processedHistory;
}

/**
 * Checks for existing entries at millisecond precision
 * This handles cases where browsers round microseconds differently
 */
async function checkForMillisecondDuplicates(
	entries: BrowsingHistoryInsert[]
): Promise<BrowsingHistoryInsert[]> {
	if (entries.length === 0) return entries;

	// Group entries by hostname for efficient querying
	const entriesByHostname = entries.reduce(
		(acc, entry) => {
			const hostname = entry.hostname;
			if (!acc[hostname]) {
				acc[hostname] = [];
			}
			acc[hostname].push(entry);
			return acc;
		},
		{} as Record<string, BrowsingHistoryInsert[]>
	);

	const dedupedEntries: BrowsingHistoryInsert[] = [];

	for (const [hostname, hostnameEntries] of Object.entries(entriesByHostname)) {
		// Get all unique millisecond timestamps for this hostname
		const millisecondTimestamps = [
			...new Set(
				hostnameEntries
					.map((e) => {
						if (!e.viewEpochMicroseconds) return null;
						// Round to milliseconds
						return (BigInt(e.viewEpochMicroseconds) / 1000000n) * 1000000n;
					})
					.filter((t) => t !== null)
			),
		] as bigint[];

		if (millisecondTimestamps.length === 0) {
			dedupedEntries.push(...hostnameEntries);
			continue;
		}

		// Query existing entries at millisecond precision
		const existingEntries = await db
			.select({
				url: browsingHistory.url,
				viewEpochMicroseconds: browsingHistory.viewEpochMicroseconds,
			})
			.from(browsingHistory)
			.where(
				and(
					eq(browsingHistory.hostname, hostname),
					// Check for any microsecond value within the same millisecond
					sql`(${browsingHistory.viewEpochMicroseconds} / 1000000) * 1000000 IN (${sql.join(millisecondTimestamps, sql`, `)})`
				)
			);

		// Create a Set of existing entries at millisecond precision
		const existingMillisecondKeys = new Set(
			existingEntries.map((e) => {
				if (!e.viewEpochMicroseconds) return '';
				const ms = (BigInt(e.viewEpochMicroseconds) / 1000000n) * 1000000n;
				return `${ms}:${e.url}`;
			})
		);

		// Filter out entries that already exist at millisecond precision
		for (const entry of hostnameEntries) {
			if (!entry.viewEpochMicroseconds) {
				dedupedEntries.push(entry);
				continue;
			}

			const ms = (BigInt(entry.viewEpochMicroseconds) / 1000000n) * 1000000n;
			const key = `${ms}:${entry.url}`;

			if (!existingMillisecondKeys.has(key)) {
				dedupedEntries.push(entry);
			}
		}
	}

	const skipped = entries.length - dedupedEntries.length;
	if (skipped > 0) {
		logger.info(`Pre-filtered ${skipped} entries that already exist at millisecond precision`);
	}

	return dedupedEntries;
}

/**
 * Inserts history entries into the database
 *
 * @param processedHistory - The processed history entries
 */
async function insertHistoryEntries(processedHistory: BrowsingHistoryInsert[]): Promise<void> {
	logger.info(`Inserting ${processedHistory.length} new history entries`);

	// Pre-filter entries that might already exist at millisecond precision
	const dedupedHistory = await checkForMillisecondDuplicates(processedHistory);

	if (dedupedHistory.length === 0) {
		logger.info('All entries already exist (detected at millisecond precision)');
		return;
	}

	// Insert in batches to avoid overwhelming the database
	const totalBatches = Math.ceil(dedupedHistory.length / BATCH_SIZE);
	let skippedCount = 0;

	for (let i = 0; i < dedupedHistory.length; i += BATCH_SIZE) {
		const batch = dedupedHistory.slice(i, i + BATCH_SIZE);

		// Use onConflictDoNothing to skip duplicate entries
		// The unique constraint on (hostname, viewEpochMicroseconds, url) will prevent duplicates
		const result = await db
			.insert(browsingHistory)
			.values(batch)
			.onConflictDoNothing()
			.returning({ id: browsingHistory.id });

		const insertedCount = result.length;
		const expectedCount = batch.length;
		if (insertedCount < expectedCount) {
			skippedCount += expectedCount - insertedCount;
		}

		logger.info(
			`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} of ${totalBatches} (${insertedCount}/${expectedCount} entries)`
		);
	}

	if (skippedCount > 0) {
		logger.info(`Skipped ${skippedCount} duplicate entries`);
	}
	logger.complete('New history entries inserted');
}

/**
 * Creates a sync function for a specific browser
 *
 * @param browserConfig - The browser configuration
 * @returns A function that syncs the browser's history
 */
export { syncBrowserHistory };

export function createBrowserSyncFunction(browserConfig: BrowserConfig) {
	return async (): Promise<void> => {
		try {
			await runIntegration('browser_history', (integrationRunId) =>
				syncBrowserHistory(browserConfig, integrationRunId)
			);
		} catch (error) {
			logger.error(`Error syncing ${browserConfig.displayName} browser history`, error);
			throw error;
		}
	};
}
