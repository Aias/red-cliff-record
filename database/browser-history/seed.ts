import { arcDb } from './db';
import { db } from '../src/db';
import {
	browsingHistory,
	integrationRuns,
	RunType,
	IntegrationType,
	integrations,
	IntegrationStatus
} from '../src/schema';
import { eq, and, notLike, sql } from 'drizzle-orm';
import { visits, urls, contentAnnotations, contextAnnotations } from './drizzle/schema';
import { sanitizeString } from '../lib/sanitize';

const dailyVisitsQuery = arcDb
	.select({
		visitDate: sql<string>`date(${visits.visitTime}/1000000-11644473600, 'unixepoch', 'localtime')`,
		url: urls.url,
		title: urls.title,
		visitCount: sql<number>`COUNT(*)`,
		totalDurationSeconds: sql<number>`ROUND(SUM(${visits.visitDuration}/1000000.0), 1)`,
		searchTerms: sql<string>`GROUP_CONCAT(DISTINCT ${contentAnnotations.searchTerms})`,
		pageLanguages: sql<string>`GROUP_CONCAT(DISTINCT ${contentAnnotations.pageLanguage})`,
		relatedSearches: sql<string>`GROUP_CONCAT(DISTINCT ${contentAnnotations.relatedSearches})`,
		responseCodes: sql<string>`GROUP_CONCAT(DISTINCT ${contextAnnotations.responseCode})`,
		firstVisit: sql<string>`MIN(datetime(${visits.visitTime}/1000000-11644473600, 'unixepoch', 'localtime'))`,
		lastVisit: sql<string>`MAX(datetime(${visits.visitTime}/1000000-11644473600, 'unixepoch', 'localtime'))`
	})
	.from(visits)
	.fullJoin(urls, eq(visits.url, urls.id))
	.leftJoin(contentAnnotations, eq(visits.id, contentAnnotations.visitId))
	.leftJoin(contextAnnotations, eq(visits.id, contextAnnotations.visitId))
	.where(
		and(
			notLike(urls.url, 'chrome-extension://%'),
			notLike(urls.url, 'chrome://%'),
			notLike(urls.url, 'about:%')
		)
	)
	.groupBy(
		sql`date(${visits.visitTime}/1000000-11644473600, 'unixepoch', 'localtime')`,
		urls.url,
		urls.title
	);

const main = async () => {
	const integrationType = await db
		.select()
		.from(integrations)
		.where(eq(integrations.type, IntegrationType.BROWSER_HISTORY));

	if (integrationType.length === 0) {
		console.error('Could not find corresponding integration type for browser history.');
		return;
	}

	const run = await db
		.insert(integrationRuns)
		.values({
			type: RunType.FULL,
			integrationId: integrationType[0].id,
			runStartTime: new Date()
		})
		.returning();

	if (run.length === 0) {
		console.error('Could not create integration run.');
		return;
	}
	console.log(`Created integration run with id ${run[0].id}`);

	try {
		console.log('Deleting existing browsing history.');
		await db.delete(browsingHistory);
		console.log('Browsing history deleted.');

		const rawHistory = await dailyVisitsQuery;
		const history = rawHistory.map((h) => ({
			date: new Date(h.visitDate),
			url: h.url as string,
			pageTitle: sanitizeString(h.title as string),
			visitCount: h.visitCount,
			totalVisitDurationSeconds: Math.round(h.totalDurationSeconds),
			searchTerms: h.searchTerms ? sanitizeString(h.searchTerms) : null,
			relatedSearches: h.relatedSearches ? sanitizeString(h.relatedSearches) : null,
			responseCodes: h.responseCodes ? sanitizeString(h.responseCodes) : null,
			firstVisitTime: new Date(h.firstVisit),
			lastVisitTime: new Date(h.lastVisit),
			integrationRunId: run[0].id
		}));

		console.log(`Inserting ${history.length} rows into browsing_history`);
		const chunkSize = 100;
		for (let i = 0; i < history.length; i += chunkSize) {
			const chunk = history.slice(i, i + chunkSize);
			await db.insert(browsingHistory).values(chunk);
			console.log(
				`Inserted chunk ${i / chunkSize + 1} of ${Math.ceil(history.length / chunkSize)}`
			);
		}
		console.log('History rows inserted.');

		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.SUCCESS,
				runEndTime: new Date(),
				entriesCreated: history.length
			})
			.where(eq(integrationRuns.id, run[0].id));
		console.log(`Updated integration run with id ${run[0].id}`);
	} catch (err) {
		console.error('Error inserting browsing history:', err);
		await db
			.update(integrationRuns)
			.set({ status: IntegrationStatus.FAIL, runEndTime: new Date() })
			.where(eq(integrationRuns.id, run[0].id));
		console.error(`Updated integration run with id ${run[0].id} to failed`);
	}

	console.log('Integration run updated.');
};

main();
