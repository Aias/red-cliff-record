import { arcSchema } from '@hozo';
import { asc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { DailyVisitsQueryRow } from './types';

// Import the browser-specific schema tables
// These are identical for Arc and Dia, but we import dynamically
// to support potential future divergence

export const CHROME_EPOCH_TO_UNIX_SECONDS =
  Math.floor(Date.UTC(1970, 0, 1) - Date.UTC(1601, 0, 1)) / 1000;

export const chromeEpochMicrosecondsToDatetime = (
  chromeEpochMicroseconds: number | bigint
): Date => {
  return new Date(
    (Number(chromeEpochMicroseconds) / 1000000 - CHROME_EPOCH_TO_UNIX_SECONDS) * 1000
  );
};

export const createDailyVisitsQuery = (db: LibSQLDatabase<typeof arcSchema>) => {
  return db
    .select({
      viewTime: arcSchema.visits.visitTime,
      viewDuration: arcSchema.visits.visitDuration,
      durationSinceLastView: arcSchema.contextAnnotations.durationSinceLastVisit,
      url: arcSchema.urls.url,
      pageTitle: arcSchema.urls.title,
      searchTerms: arcSchema.contentAnnotations.searchTerms,
      relatedSearches: arcSchema.contentAnnotations.relatedSearches,
    })
    .from(arcSchema.visits)
    .orderBy(asc(arcSchema.visits.visitTime), asc(arcSchema.visits.url))
    .fullJoin(arcSchema.urls, eq(arcSchema.visits.url, arcSchema.urls.id))
    .leftJoin(
      arcSchema.contentAnnotations,
      eq(arcSchema.visits.id, arcSchema.contentAnnotations.visitId)
    )
    .leftJoin(
      arcSchema.contextAnnotations,
      eq(arcSchema.visits.id, arcSchema.contextAnnotations.visitId)
    );
};

export const collapseSequentialVisits = (dailyHistory: DailyVisitsQueryRow[]) => {
  const collapsed: DailyVisitsQueryRow[] = [];
  let current: DailyVisitsQueryRow | null = null;

  for (const visit of dailyHistory) {
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
