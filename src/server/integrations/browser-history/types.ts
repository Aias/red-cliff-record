import { emptyStringToNull, type arcSchema, type Browser } from '@hozo';
import type { Client } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { z } from 'zod';

const sanitizeString = (str: string | null): string | null => {
  if (!str) return null;
  // eslint-disable-next-line no-control-regex -- intentionally removing null characters from browser history
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

export interface BrowserConnection {
  db: LibSQLDatabase<typeof arcSchema>;
  client: Client;
}

export interface BrowserConfig {
  name: Browser;
  displayName: string;
  createConnection: () => Promise<BrowserConnection>;
  // Optional cutoff date to avoid fetching history before this date
  // Useful for browsers that import history from other browsers
  cutoffDate?: Date;
}

/**
 * Custom error for when a browser is not installed (history file missing)
 */
export class BrowserNotInstalledError extends Error {
  constructor(browserName: string, filePath: string) {
    super(`${browserName} browser not installed (missing file: ${filePath})`);
    this.name = 'BrowserNotInstalledError';
  }
}
