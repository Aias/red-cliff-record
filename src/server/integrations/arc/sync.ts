import os from 'os';
import readline from 'readline';
import { and, desc, eq, gt, isNotNull, ne, notLike } from 'drizzle-orm';
import { chromeEpochMicrosecondsToDatetime } from '~/app/lib/time-helpers';
import { db } from '~/server/db/connections';
import { urls, visits } from '~/server/db/schema/arc';
import { Browser, browsingHistory, type BrowsingHistoryInsert } from '~/server/db/schema/history';
import { runIntegration } from '../common/run-integration';
import { collapseSequentialVisits, dailyVisitsQuery } from './helpers';
import { DailyVisitsQueryResultSchema } from './types';

// Helper function to create readline interface
const createPrompt = () => {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
};

// Helper function to ask for confirmation
const askForConfirmation = async (message: string): Promise<boolean> => {
	const rl = createPrompt();

	return new Promise((resolve) => {
		rl.question(`${message} (y/N) `, (answer) => {
			rl.close();
			resolve(answer.toLowerCase() === 'y');
		});
	});
};

// Define a maximum acceptable URL length.
const MAX_URL_LENGTH = 1000;

// This helper will attempt to remove non-critical query parameters
// instead of simply chopping off the URL. Adjust the list as needed.
function sanitizeUrl(url: string): string | null {
	if (url.length <= MAX_URL_LENGTH) return url;

	try {
		const parsed = new URL(url);
		// List of query parameters that are likely not critical for history purposes.
		// Remove any parameters that are not essential.
		const removableParams = [
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
		for (const param of removableParams) {
			parsed.searchParams.delete(param);
		}
		const sanitized = parsed.toString();
		if (sanitized.length <= MAX_URL_LENGTH) {
			return sanitized;
		} else {
			return null; // Still too long.
		}
	} catch (err) {
		console.warn('Failed to parse URL, excluding record:', url, err);
		return null;
	}
}

async function syncBrowserHistory(integrationRunId: number): Promise<number> {
	const currentHostname = os.hostname();

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
		const shouldProceed = await askForConfirmation(
			`Current hostname "${currentHostname}" has not been seen before. Proceed with sync?`
		);

		if (!shouldProceed) {
			console.log('Sync cancelled by user');
			return 0;
		}
	}

	console.log('Starting Arc browser history incremental update...');

	// Get the most recent viewEpochMicroseconds from the database
	const latestVisit = await db.query.browsingHistory.findFirst({
		columns: {
			viewEpochMicroseconds: true,
		},
		where: and(
			eq(browsingHistory.browser, Browser.enum.arc),
			eq(browsingHistory.hostname, currentHostname),
			isNotNull(browsingHistory.viewEpochMicroseconds)
		),
		orderBy: desc(browsingHistory.viewEpochMicroseconds),
	});

	const lastKnownTime = latestVisit?.viewEpochMicroseconds;
	const date = lastKnownTime ? chromeEpochMicrosecondsToDatetime(lastKnownTime) : null;
	console.log(
		`Last known visit time: ${date ? `${date.toLocaleString()} (${date.toISOString()})` : 'none'}`
	);

	console.log('Retrieving new history entries...');
	const rawHistory = await dailyVisitsQuery.where(
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
	console.log(`Retrieved ${rawHistory.length} new history entries`);

	const dailyHistory = DailyVisitsQueryResultSchema.parse(rawHistory);

	const collapsedHistory = collapseSequentialVisits(dailyHistory);
	console.log(`Collapsed into ${collapsedHistory.length} entries`);

	const history: BrowsingHistoryInsert[] = collapsedHistory.map((h) => ({
		browser: Browser.enum.arc,
		hostname: currentHostname,
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

	const processedHistory: BrowsingHistoryInsert[] = [];
	for (const h of history) {
		const sanitizedUrl = sanitizeUrl(h.url);
		if (sanitizedUrl === null) {
			continue;
		}
		processedHistory.push({
			...h,
			url: sanitizedUrl,
		});
	}

	if (processedHistory.length > 0) {
		console.log(`Inserting ${processedHistory.length} new history entries`);
		const chunkSize = 100;
		for (let i = 0; i < processedHistory.length; i += chunkSize) {
			const chunk = processedHistory.slice(i, i + chunkSize);
			await db.insert(browsingHistory).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(processedHistory.length / chunkSize)}`
			);
		}
		console.log('New history entries inserted');
	} else {
		console.log('No new history entries to insert');
	}

	return processedHistory.length;
}

const main = async () => {
	try {
		await runIntegration('browser_history', syncBrowserHistory);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./sync.ts')) {
	main();
}

export { main as syncArcBrowserHistory };
