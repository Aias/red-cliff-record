import os from 'os';
import readline from 'readline';
import { and, eq, gt, isNotNull, ne, notLike } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { urls, visits } from '@/server/db/schema/arc';
import { Browser, browsingHistory, type BrowsingHistoryInsert } from '@/server/db/schema/history';
import { runIntegration } from '../common/run-integration';
import {
	chromeEpochMicrosecondsToDatetime,
	collapseSequentialVisits,
	dailyVisitsQuery,
} from './helpers';
import { DailyVisitsQueryResultSchema } from './types';

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
		console.warn('Failed to parse URL, excluding record:', url, error);
		return null;
	}
}

/**
 * Synchronizes Arc browser history with the database
 *
 * This function:
 * 1. Checks if the current hostname is known
 * 2. Retrieves the most recent history entry
 * 3. Fetches new history entries
 * 4. Processes and sanitizes the entries
 * 5. Inserts them into the database
 *
 * @param integrationRunId - The ID of the current integration run
 * @returns The number of history entries inserted
 * @throws Error if synchronization fails
 */
async function syncBrowserHistory(integrationRunId: number): Promise<number> {
	try {
		// Get current hostname
		const currentHostname = os.hostname();

		// Step 1: Check if the current hostname is known
		const shouldProceed = await checkHostname(currentHostname);
		if (!shouldProceed) {
			console.log('Sync cancelled by user');
			return 0;
		}

		console.log('Starting Arc browser history incremental update...');

		// Step 2: Get the most recent history entry
		const lastKnownTime = await getLastSyncPoint(currentHostname);
		logLastSyncPoint(lastKnownTime);

		// Step 3: Fetch new history entries
		console.log('Retrieving new history entries...');
		const rawHistory = await fetchNewHistoryEntries(lastKnownTime);
		console.log(`Retrieved ${rawHistory.length} new history entries`);

		// Step 4: Process and sanitize the entries
		const processedHistory = processHistoryEntries(rawHistory, currentHostname, integrationRunId);

		// Step 5: Insert the entries into the database
		if (processedHistory.length > 0) {
			await insertHistoryEntries(processedHistory);
		} else {
			console.log('No new history entries to insert');
		}

		return processedHistory.length;
	} catch (error) {
		console.error('Error syncing browser history:', error);
		throw new Error(
			`Failed to sync browser history: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Checks if the current hostname is known and asks for confirmation if not
 *
 * @param currentHostname - The current hostname
 * @returns Promise that resolves to true if the sync should proceed, false otherwise
 */
async function checkHostname(currentHostname: string): Promise<boolean> {
	// Get all unique hostnames from the database
	const uniqueHostnames = await db
		.select({
			hostname: browsingHistory.hostname,
		})
		.from(browsingHistory)
		.where(eq(browsingHistory.browser, Browser.enum.arc))
		.groupBy(browsingHistory.hostname);

	const knownHostnames = new Set(uniqueHostnames.map((h) => h.hostname));

	// If current hostname is not in the database, ask for confirmation
	if (!knownHostnames.has(currentHostname)) {
		console.log('Known hostnames:', Array.from(knownHostnames).join(', '));
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
 * @returns The timestamp of the most recent entry, or null if none exists
 */
async function getLastSyncPoint(hostname: string): Promise<bigint | null> {
	const latestVisit = await db.query.browsingHistory.findFirst({
		columns: {
			viewEpochMicroseconds: true,
		},
		where: {
			browser: Browser.enum.arc,
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
		console.log(`Last known visit time: ${date.toLocaleString()} (${date.toISOString()})`);
	} else {
		console.log('Last known visit time: none');
	}
}

/**
 * Fetches new history entries from the database
 *
 * @param lastKnownTime - The timestamp of the most recent entry
 * @returns Array of new history entries
 */
async function fetchNewHistoryEntries(lastKnownTime: bigint | null) {
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
 * @returns Array of processed history entries
 */
function processHistoryEntries(
	rawHistory: unknown[],
	hostname: string,
	integrationRunId: number
): BrowsingHistoryInsert[] {
	// Parse and validate the history data
	const dailyHistory = DailyVisitsQueryResultSchema.parse(rawHistory);

	// Collapse sequential visits to the same URL
	const collapsedHistory = collapseSequentialVisits(dailyHistory);
	console.log(`Collapsed into ${collapsedHistory.length} entries`);

	// Convert to database format
	const history: BrowsingHistoryInsert[] = collapsedHistory.map((h) => ({
		browser: Browser.enum.arc,
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
 * Inserts history entries into the database
 *
 * @param processedHistory - The processed history entries
 */
async function insertHistoryEntries(processedHistory: BrowsingHistoryInsert[]): Promise<void> {
	console.log(`Inserting ${processedHistory.length} new history entries`);

	// Insert in batches to avoid overwhelming the database
	const totalBatches = Math.ceil(processedHistory.length / BATCH_SIZE);

	for (let i = 0; i < processedHistory.length; i += BATCH_SIZE) {
		const batch = processedHistory.slice(i, i + BATCH_SIZE);
		await db.insert(browsingHistory).values(batch);
		console.log(`Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} of ${totalBatches}`);
	}

	console.log('New history entries inserted');
}

/**
 * Orchestrates the Arc browser history synchronization process
 */
async function syncArcBrowserData(): Promise<void> {
	try {
		console.log('Starting Arc browser history synchronization');
		await runIntegration('browser_history', syncBrowserHistory);
		console.log('Arc browser history synchronization completed successfully');
	} catch (error) {
		console.error('Error syncing Arc browser history:', error);
		throw error;
	}
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING ARC BROWSER SYNC ===\n');
		await syncArcBrowserData();
		console.log('\n=== ARC BROWSER SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Arc browser sync main function:', error);
		console.log('\n=== ARC BROWSER SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { syncArcBrowserData };
