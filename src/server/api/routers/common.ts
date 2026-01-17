import { cosineDistance, sql, type Column } from 'drizzle-orm';

export const SIMILARITY_THRESHOLD = 0.8; // Lower is more strict

export const similarity = (column: Column, vector: number[]) => {
  return sql<number>`1 - (${cosineDistance(column, vector)})`.as('similarity');
};
