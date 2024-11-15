import { createPgConnection } from '@schema/connections';
import { browsingHistory, browsingHistoryDaily, Browser } from '@schema/main';
import { IntegrationType } from '@schema/main/integrations';
import { eq, and, isNotNull, ne, notLike } from 'drizzle-orm';
import { sanitizeString } from '@utils/sanitize';
import { runIntegration } from '@utils/run-integration';
import {
	chromeEpochMicrosecondsToDatetime,
	datetimeToChromeEpochMicroseconds
} from '@lib/time-helpers';
import os from 'os';
import { dailyVisitsQuery, collapseSequentialVisits } from './helpers';
import { urls } from '@schema/arc';

const pgDb = createPgConnection();

async function processArcBrowserHistory(integrationRunId: number): Promise<number> {
	const hostname = os.hostname();
	console.log(`Cleaning up existing Arc browser history for ${hostname}...`);
	await pgDb
		.delete(browsingHistory)
		.where(and(eq(browsingHistory.browser, Browser.ARC), eq(browsingHistory.hostname, hostname)));
	console.log('Cleanup complete');

	console.log('Retrieving raw history...');
	const rawHistory = await dailyVisitsQuery.where(
		and(
			notLike(urls.url, 'chrome-extension://%'),
			notLike(urls.url, 'chrome://%'),
			notLike(urls.url, 'about:%'),
			isNotNull(urls.url),
			isNotNull(urls.title),
			ne(urls.title, ''),
			ne(urls.url, '')
		)
	);
	console.log(`Retrieved ${rawHistory.length} raw history entries`);

	const collapsedHistory = collapseSequentialVisits(rawHistory);
	console.log(`Collapsed into ${collapsedHistory.length} entries`);

	const history: (typeof browsingHistory.$inferInsert)[] = collapsedHistory.map((h) => ({
		viewTime: h.viewTime ? chromeEpochMicrosecondsToDatetime(h.viewTime) : new Date(),
		viewEpochMicroseconds: h.viewTime
			? BigInt(h.viewTime)
			: datetimeToChromeEpochMicroseconds(new Date()),
		viewDuration: h.viewDuration ? Math.round(h.viewDuration / 1000000) : 0,
		durationSinceLastView: h.durationSinceLastView
			? Math.round(h.durationSinceLastView / 1000000)
			: 0,
		url: h.url as string,
		pageTitle: h.pageTitle as string,
		searchTerms: h.searchTerms ? sanitizeString(h.searchTerms) : null,
		relatedSearches: h.relatedSearches ? sanitizeString(h.relatedSearches) : null,
		integrationRunId,
		browser: Browser.ARC,
		hostname
	}));

	console.log(`Inserting ${history.length} rows into browsing_history`);
	const chunkSize = 100;
	for (let i = 0; i < history.length; i += chunkSize) {
		const chunk = history.slice(i, i + chunkSize);
		await pgDb.insert(browsingHistory).values(chunk);
		console.log(`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(history.length / chunkSize)}`);
	}
	console.log('History rows inserted');

	console.log('Refreshing materialized view...');
	await pgDb.refreshMaterializedView(browsingHistoryDaily);
	console.log('Materialized view refreshed');

	return history.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.BROWSER_HISTORY, processArcBrowserHistory);
		process.exit();
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed.ts')) {
	main();
}

export { main as seedBrowserHistory };
