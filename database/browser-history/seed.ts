import { arcDb } from './db';
import { db } from '../src/db';
import { browsingHistory, browsingHistoryDaily, Browser, IntegrationType } from '../src/schema';
import { eq, and, notLike, isNotNull, ne } from 'drizzle-orm';
import { visits, urls, contentAnnotations, contextAnnotations } from './drizzle/schema';
import { sanitizeString } from '../lib/sanitize';
import { runIntegration } from '../lib/integration';
import { chromeEpochMicrosecondsToDatetime, datetimeToChromeEpochMicroseconds } from './constants';
import os from 'os';
const dailyVisitsQuery = arcDb
	.select({
		viewTime: visits.visitTime,
		viewDuration: visits.visitDuration,
		durationSinceLastView: contextAnnotations.durationSinceLastVisit,
		url: urls.url,
		pageTitle: urls.title,
		searchTerms: contentAnnotations.searchTerms,
		relatedSearches: contentAnnotations.relatedSearches
	})
	.from(visits)
	.fullJoin(urls, eq(visits.url, urls.id))
	.leftJoin(contentAnnotations, eq(visits.id, contentAnnotations.visitId))
	.leftJoin(contextAnnotations, eq(visits.id, contextAnnotations.visitId))
	.where(
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

const collapseSequentialVisits = (rawHistory: typeof dailyVisitsQuery._.result) => {
	const collapsed: typeof rawHistory = [];
	let current: (typeof rawHistory)[0] | null = null;

	for (const visit of rawHistory) {
		if (!current) {
			current = { ...visit };
			continue;
		}

		// If this is a sequential visit to the same URL
		if (
			current.url === visit.url &&
			current.pageTitle &&
			visit.pageTitle &&
			current.pageTitle === visit.pageTitle
		) {
			// Only add positive durations
			if (visit.viewDuration && visit.viewDuration > 0) {
				current.viewDuration = (current.viewDuration || 0) + visit.viewDuration;
			}
			// Keep the earliest viewTime
			current.viewTime =
				!current.viewTime || !visit.viewTime || current.viewTime < visit.viewTime
					? current.viewTime
					: visit.viewTime;
			// Keep the maximum durationSinceLastView
			current.durationSinceLastView = Math.max(
				current.durationSinceLastView || 0,
				visit.durationSinceLastView || 0
			);
		} else {
			// Different URL or title, push the current group and start a new one
			collapsed.push(current);
			current = { ...visit };
		}
	}

	// Don't forget to push the last group
	if (current) {
		collapsed.push(current);
	}

	return collapsed;
};

async function processArcBrowserHistory(integrationRunId: number): Promise<number> {
	const hostname = os.hostname();
	console.log(`Cleaning up existing Arc browser history for ${hostname}...`);
	await db.delete(browsingHistory).where(and(eq(browsingHistory.browser, Browser.ARC), eq(browsingHistory.hostname, hostname)));
	console.log('Cleanup complete');

	console.log('Retrieving raw history...');
	const rawHistory = await dailyVisitsQuery;
	console.log(`Retrieved ${rawHistory.length} raw history entries`);

	const collapsedHistory = collapseSequentialVisits(rawHistory);
	console.log(`Collapsed into ${collapsedHistory.length} entries`);

	const history: typeof browsingHistory.$inferInsert[] = collapsedHistory.map((h) => ({
		viewTime: h.viewTime
			? chromeEpochMicrosecondsToDatetime(h.viewTime)
			: new Date(),
		viewEpochMicroseconds: h.viewTime ? BigInt(h.viewTime) : datetimeToChromeEpochMicroseconds(new Date()),
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
		await db.insert(browsingHistory).values(chunk);
		console.log(`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(history.length / chunkSize)}`);
	}
	console.log('History rows inserted');

	console.log('Refreshing materialized view...');
	await db.refreshMaterializedView(browsingHistoryDaily);
	console.log('Materialized view refreshed');

	return history.length;
}

const main = async () => {
	try {
		await runIntegration(IntegrationType.BROWSER_HISTORY, processArcBrowserHistory);
	} catch (err) {
		console.error('Error in main:', err);
		process.exit(1);
	}
};

if (import.meta.url === import.meta.resolve('./seed.ts')) {
	main();
}

export { main as seedBrowserHistory };
