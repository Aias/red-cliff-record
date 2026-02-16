import { cosineDistance, sql, type Column } from 'drizzle-orm';

export const SIMILARITY_THRESHOLD = 0.8; // Cosine similarity floor (higher = stricter)
export const TRIGRAM_DISTANCE_THRESHOLD = 0.75; // pg_trgm distance ceiling (lower = stricter)

export const similarity = (column: Column, vector: number[]) => {
  return sql<number>`1 - (${cosineDistance(column, vector)})`.as('similarity');
};
