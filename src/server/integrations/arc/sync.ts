import os from 'os';
import readline from 'readline';
import { and, desc, eq, gt, isNotNull, ne, notLike } from 'drizzle-orm';
import { chromeEpochMicrosecondsToDatetime } from '~/app/lib/time-helpers';
import { db } from '~/server/db/connections';
import { urls, visits } from '~/server/db/schema/arc';
import {
	arcBrowsingHistory,
	Browser,
	type ArcBrowsingHistoryInsert,
} from '~/server/db/schema/integrations';
import { runIntegration } from '../common/run-integration';
import { collapseSequentialVisits, dailyVisitsQuery } from './helpers';
import { DailyVisitsQueryResultSchema } from './types';

// Helper function to create readline interface
const createPrompt = () => {
	return readline.createInterface({
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		input: process.stdin as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		output: process.stdout as any,
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

async function syncBrowserHistory(integrationRunId: number): Promise<number> {
	const currentHostname = os.hostname();

	// Get all unique hostnames from the database
	const uniqueHostnames = await db
		.select({
			hostname: arcBrowsingHistory.hostname,
		})
		.from(arcBrowsingHistory)
		.where(eq(arcBrowsingHistory.browser, Browser.enum.arc))
		.groupBy(arcBrowsingHistory.hostname);

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
	const latestVisit = await db.query.arcBrowsingHistory.findFirst({
		columns: {
			viewEpochMicroseconds: true,
		},
		where: and(
			eq(arcBrowsingHistory.browser, Browser.enum.arc),
			eq(arcBrowsingHistory.hostname, currentHostname),
			isNotNull(arcBrowsingHistory.viewEpochMicroseconds)
		),
		orderBy: desc(arcBrowsingHistory.viewEpochMicroseconds),
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

	const history: ArcBrowsingHistoryInsert[] = collapsedHistory.map((h) => ({
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

	if (history.length > 0) {
		console.log(`Inserting ${history.length} new history entries`);
		const chunkSize = 100;
		for (let i = 0; i < history.length; i += chunkSize) {
			const chunk = history.slice(i, i + chunkSize);
			await db.insert(arcBrowsingHistory).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(history.length / chunkSize)}`
			);
		}
		console.log('New history entries inserted');
	} else {
		console.log('No new history entries to insert');
	}

	return history.length;
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
