import { cosineDistance, sql, type Column } from 'drizzle-orm';
import { z } from 'zod';

export const DEFAULT_LIMIT = 50;
export const SIMILARITY_THRESHOLD = 0.8; // Lower is more strict

export const similarity = (column: Column, vector: number[]) => {
	return sql<number>`1 - (${cosineDistance(column, vector)})`.as('similarity');
};
export const IdSchema = z.number().int().positive();
