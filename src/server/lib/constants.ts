import { cosineDistance, sql, type Column } from 'drizzle-orm';

export const SIMILARITY_THRESHOLD = 0.8; // Cosine similarity floor (higher = stricter)
export const TRIGRAM_DISTANCE_THRESHOLD = 0.75; // pg_trgm distance ceiling (lower = stricter)
export const WORD_SIMILARITY_THRESHOLD = 0.5; // pg_trgm word_similarity floor for phrase matching
export const WORD_SIMILARITY_DISTANCE_THRESHOLD = 1 - WORD_SIMILARITY_THRESHOLD;

export const similarity = (column: Column, vector: number[]) => {
  return sql<number>`1 - (${cosineDistance(column, vector)})`.as('similarity');
};

/** Best trigram distance across title, abbreviation, content, summary.
 * Uses word_similarity (<<->) for multi-word queries on content/summary. */
export const trigramDistance = (
  columns: { title: Column; abbreviation: Column; content: Column; summary: Column },
  query: string
) =>
  sql`LEAST(
    LEAST(${columns.title} <-> ${query}, ${query} <<-> ${columns.title}),
    LEAST(${columns.abbreviation} <-> ${query}, ${query} <<-> ${columns.abbreviation}),
    CASE
      WHEN POSITION(' ' IN ${query}) > 0
      THEN LEAST(${columns.content} <-> ${query}, ${query} <<-> ${columns.content})
      ELSE ${columns.content} <-> ${query}
    END,
    CASE
      WHEN POSITION(' ' IN ${query}) > 0
      THEN LEAST(${columns.summary} <-> ${query}, ${query} <<-> ${columns.summary})
      ELSE ${columns.summary} <-> ${query}
    END
  )`;
