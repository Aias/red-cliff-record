import { and, isNull, type Column, type SQL } from 'drizzle-orm';
import { z } from 'zod';

export const DEFAULT_LIMIT = 50;
export const SIMILARITY_THRESHOLD = 0.8; // Lower is more strict

export const RequestParamsSchema = z
	.object({
		limit: z.number().default(DEFAULT_LIMIT),
		includeArchived: z.boolean().default(false),
		includeMapped: z.boolean().default(false),
	})
	.default({});

export type RequestParams = z.infer<typeof RequestParamsSchema>;

export const buildWhereClause = (
	params: RequestParams,
	archivedColumn: Column,
	mappedColumn: Column,
	additionalClauses?: SQL[]
): SQL | undefined => {
	const conditions: SQL[] = [];
	if (!params.includeArchived) {
		conditions.push(isNull(archivedColumn));
	}
	if (!params.includeMapped) {
		conditions.push(isNull(mappedColumn));
	}
	if (additionalClauses) {
		conditions.push(...additionalClauses);
	}
	return and(...conditions);
};
