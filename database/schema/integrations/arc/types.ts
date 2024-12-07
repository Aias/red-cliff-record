import { z } from 'zod';
import { emptyStringToNull } from '../../utils/schema-helpers';

export const DailyVisitsQueryRowSchema = z.object({
	viewTime: z.number().int().nonnegative(),
	viewDuration: z.number().int().default(0),
	durationSinceLastView: z.number().int().default(0),
	url: z.string(),
	pageTitle: emptyStringToNull(z.string()),
	searchTerms: emptyStringToNull(z.string()),
	relatedSearches: emptyStringToNull(z.string()),
});
export const DailyVisitsQueryResultSchema = z.array(DailyVisitsQueryRowSchema);

export type DailyVisitsQueryResult = z.infer<typeof DailyVisitsQueryResultSchema>;
export type DailyVisitsQueryRow = z.infer<typeof DailyVisitsQueryRowSchema>;
