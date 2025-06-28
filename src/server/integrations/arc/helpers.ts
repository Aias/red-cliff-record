// This file has been moved to browser-history/helpers.ts
// Re-export for backward compatibility
export {
	CHROME_EPOCH_TO_UNIX_SECONDS,
	chromeEpochMicrosecondsToDatetime,
	collapseSequentialVisits,
} from '../browser-history/helpers';

// Note: dailyVisitsQuery is no longer a static export
// It's now created dynamically via createDailyVisitsQuery(db)
