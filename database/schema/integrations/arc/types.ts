import { z } from 'zod';
import { emptyStringToNull } from '../../utils/schema-helpers';

export function sanitizeString(str: string | null): string | null {
	if (!str) return null;
	return str.replace(/\0/g, '').trim();
}

export const DailyVisitsQueryRowSchema = z.object({
	viewTime: z.number().int().nonnegative(),
	viewDuration: z.number().int().default(0),
	durationSinceLastView: z.number().int().nullable().default(0),
	url: z.string(),
	pageTitle: emptyStringToNull(z.string()).transform(sanitizeString),
	searchTerms: emptyStringToNull(z.string()).transform(sanitizeString),
	relatedSearches: emptyStringToNull(z.string()).transform(sanitizeString),
});
export const DailyVisitsQueryResultSchema = z.array(DailyVisitsQueryRowSchema);

export type DailyVisitsQueryResult = z.infer<typeof DailyVisitsQueryResultSchema>;
export type DailyVisitsQueryRow = z.infer<typeof DailyVisitsQueryRowSchema>;
