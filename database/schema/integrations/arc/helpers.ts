import { asc, eq } from 'drizzle-orm';
import { visits, contextAnnotations, urls, contentAnnotations } from '@schema/arc';
import { createArcConnection } from '@schema/connections';

const arcDb = createArcConnection();

export const dailyVisitsQuery = arcDb
	.select({
		viewTime: visits.visitTime,
		viewDuration: visits.visitDuration,
		durationSinceLastView: contextAnnotations.durationSinceLastVisit,
		url: urls.url,
		pageTitle: urls.title,
		searchTerms: contentAnnotations.searchTerms,
		relatedSearches: contentAnnotations.relatedSearches,
	})
	.from(visits)
	.orderBy(asc(visits.visitTime), asc(visits.url))
	.fullJoin(urls, eq(visits.url, urls.id))
	.leftJoin(contentAnnotations, eq(visits.id, contentAnnotations.visitId))
	.leftJoin(contextAnnotations, eq(visits.id, contextAnnotations.visitId));

export const collapseSequentialVisits = (rawHistory: typeof dailyVisitsQuery._.result) => {
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