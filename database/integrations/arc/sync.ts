import { createPgConnection } from '@schema/connections';
import {
	arcBrowsingHistory,
	arcBrowsingHistoryDaily,
	Browser,
	type NewArcBrowsingHistory,
} from '@schema/integrations/arc';
import { IntegrationType } from '@schema/integrations/integrations';
import { eq, and, gt, desc, notLike, isNotNull, ne } from 'drizzle-orm';
import { sanitizeString } from '@utils/sanitize';
import { runIntegration } from '@utils/run-integration';
import {
	chromeEpochMicrosecondsToDatetime,
	datetimeToChromeEpochMicroseconds,
} from '@rcr/lib/time-helpers';
import os from 'os';
import { visits, urls } from '@schema/arc';
import { collapseSequentialVisits, dailyVisitsQuery } from './helpers';

const pgDb = createPgConnection();

async function syncBrowserHistory(integrationRunId: number): Promise<number> {
	const hostname = os.hostname();
	console.log('Starting Arc browser history incremental update...');

	// Get the most recent viewEpochMicroseconds from the database
	const latestVisit = await pgDb
		.select({ viewEpochMicroseconds: arcBrowsingHistory.viewEpochMicroseconds })
		.from(arcBrowsingHistory)
		.where(
			and(
				eq(arcBrowsingHistory.browser, Browser.enum.arc),
				eq(arcBrowsingHistory.hostname, hostname),
				isNotNull(arcBrowsingHistory.viewEpochMicroseconds)
			)
		)
		.orderBy(desc(arcBrowsingHistory.viewEpochMicroseconds))
		.limit(1);

	const lastKnownTime = latestVisit[0]?.viewEpochMicroseconds;
	console.log(
		`Last known visit time: ${lastKnownTime ? new Date(Number(lastKnownTime) / 1000).toISOString() : 'none'}`
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

	const collapsedHistory = collapseSequentialVisits(rawHistory);
	console.log(`Collapsed into ${collapsedHistory.length} entries`);

	const history: NewArcBrowsingHistory[] = collapsedHistory.map((h) => ({
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
		browser: Browser.enum.arc,
		hostname,
	}));

	if (history.length > 0) {
		console.log(`Inserting ${history.length} new history entries`);
		const chunkSize = 100;
		for (let i = 0; i < history.length; i += chunkSize) {
			const chunk = history.slice(i, i + chunkSize);
			await pgDb.insert(arcBrowsingHistory).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(history.length / chunkSize)}`
			);
		}
		console.log('New history entries inserted');

		console.log('Refreshing materialized view...');
		await pgDb.refreshMaterializedView(arcBrowsingHistoryDaily);
		console.log('Materialized view refreshed');
	} else {
		console.log('No new history entries to insert');
	}

	return history.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.enum.browser_history, syncBrowserHistory);
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
