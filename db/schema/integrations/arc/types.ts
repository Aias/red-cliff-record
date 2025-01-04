import { z } from 'zod';
import { emptyStringToNull } from '../../helpers';

const sanitizeString = (str: string | null): string | null => {
	if (!str) return null;
	return str.replace(/\0/g, '').trim();
};

export const Browser = z.enum(['arc', 'chrome', 'firefox', 'safari', 'edge']);
export type Browser = z.infer<typeof Browser>;

export const DailyVisitsQueryRowSchema = z.object({
	viewTime: z.number().or(z.bigint()).transform(Number),
	viewDuration: z.number().or(z.bigint()).transform(Number).default(0),
	durationSinceLastView: z.number().or(z.bigint()).transform(Number).nullable().default(0),
	url: z.string(),
	pageTitle: emptyStringToNull(z.string()).transform(sanitizeString),
	searchTerms: emptyStringToNull(z.string()).transform(sanitizeString),
	relatedSearches: emptyStringToNull(z.string()).transform(sanitizeString),
});
export const DailyVisitsQueryResultSchema = z.array(DailyVisitsQueryRowSchema);

export type DailyVisitsQueryResult = z.infer<typeof DailyVisitsQueryResultSchema>;
export type DailyVisitsQueryRow = z.infer<typeof DailyVisitsQueryRowSchema>;
