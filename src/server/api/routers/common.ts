import { cosineDistance, sql, type Column } from 'drizzle-orm';
import { z } from 'zod/v4';

export const DEFAULT_LIMIT = 50;
export const SIMILARITY_THRESHOLD = 0.8; // Lower is more strict

export const similarity = (column: Column, vector: number[]) => {
	return sql<number>`1 - (${cosineDistance(column, vector)})`.as('similarity');
};
export const IdSchema = z.number().int().positive();
export const IdParamSchema = z.object({ id: IdSchema });
export type DbId = z.infer<typeof IdSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;

export type IdParamList = {
	ids: Array<IdParam>;
};
