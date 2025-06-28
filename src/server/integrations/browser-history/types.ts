import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { z } from 'zod/v4';
import type { Browser } from '@/db/schema/browser-history';
import type * as browserHistorySchema from '@/db/schema/browser-history';
import { emptyStringToNull } from '@/shared/lib/formatting';

const sanitizeString = (str: string | null): string | null => {
	if (!str) return null;
	return str.replace(/\0/g, '').trim();
};

export const DailyVisitsQueryRowSchema = z.object({
	viewTime: z.number().or(z.bigint()).transform(Number),
	viewDuration: z.number().or(z.bigint()).transform(Number).default(0),
	durationSinceLastView: z.number().or(z.bigint()).transform(Number).nullable().default(0),
	url: z.string(),
	pageTitle: emptyStringToNull(z.string()).transform(sanitizeString),
	searchTerms: emptyStringToNull(z.string()).transform(sanitizeString),
	relatedSearches: emptyStringToNull(z.string()).transform(sanitizeString),
});
export type DailyVisitsQueryRow = z.infer<typeof DailyVisitsQueryRowSchema>;

export const DailyVisitsQueryResultSchema = z.array(DailyVisitsQueryRowSchema);

export interface BrowserConfig {
	name: Browser;
	displayName: string;
	createConnection: () => LibSQLDatabase<typeof browserHistorySchema>;
	// Optional cutoff date to avoid fetching history before this date
	// Useful for browsers that import history from other browsers
	cutoffDate?: Date;
}
