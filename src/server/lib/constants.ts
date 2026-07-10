import { cosineDistance, sql, type Column, type SQL } from 'drizzle-orm';

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

/** Escape LIKE/ILIKE metacharacters in user input. */
const escapeLikePattern = (query: string) => query.replace(/[\\%_]/g, '\\$&');

/**
 * Build a tsquery from user input: websearch syntax for whole words, OR'd
 * with a per-word prefix query so partially typed words still match.
 */
export const toTsQuery = (query: string): SQL => {
  const prefix = query
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
    .map((word) => `${word}:*`)
    .join(' & ');

  return prefix.length > 0
    ? sql`(websearch_to_tsquery('english', ${query}) || to_tsquery('english', ${prefix}))`
    : sql`websearch_to_tsquery('english', ${query})`;
};

/** Weighted full-text rank against the record's search document. */
export const ftsRank = (textSearch: Column, query: string): SQL =>
  sql`ts_rank_cd(${textSearch}, ${toTsQuery(query)})`;

/**
 * Tiered exactness for ranking: 0 = exact title/abbreviation match,
 * 1 = title prefix, 2 = title/abbreviation substring, 3 = everything else.
 * Keeps literal matches ahead of fuzzy and semantic ones.
 */
export const exactMatchTier = (
  columns: { title: Column; abbreviation: Column },
  query: string
): SQL<number> => {
  const escaped = escapeLikePattern(query.trim());
  return sql<number>`CASE
    WHEN lower(${columns.title}) = lower(${query}) OR lower(${columns.abbreviation}) = lower(${query}) THEN 0
    WHEN ${columns.title} ILIKE ${`${escaped}%`} THEN 1
    WHEN ${columns.title} ILIKE ${`%${escaped}%`} OR ${columns.abbreviation} ILIKE ${`%${escaped}%`} THEN 2
    ELSE 3
  END`;
};

/**
 * Lexical match condition combining full-text search (whole words anywhere,
 * including long content), title/abbreviation substrings, and trigram fuzzy
 * matching for typos. The trigram operators (%, <%) read the thresholds from
 * `pg_trgm.similarity_threshold` / `pg_trgm.word_similarity_threshold`, so
 * callers must set those (see `setTrigramThresholds`).
 */
export const lexicalMatchCondition = (
  columns: {
    title: Column;
    abbreviation: Column;
    content: Column;
    summary: Column;
    textSearch: Column;
  },
  query: string
): SQL => {
  const substring = `%${escapeLikePattern(query.trim())}%`;
  return sql`(
    ${columns.textSearch} @@ ${toTsQuery(query)} OR
    ${columns.title} ILIKE ${substring} OR
    ${columns.abbreviation} ILIKE ${substring} OR
    ${columns.title} % ${query} OR ${query} <% ${columns.title} OR
    ${columns.abbreviation} % ${query} OR ${query} <% ${columns.abbreviation} OR
    ${columns.content} % ${query} OR
    (POSITION(' ' IN ${query}) > 0 AND ${query} <% ${columns.content}) OR
    ${columns.summary} % ${query} OR
    (POSITION(' ' IN ${query}) > 0 AND ${query} <% ${columns.summary})
  )`;
};

/** Set the pg_trgm thresholds the % / <% operators in `lexicalMatchCondition` read. */
export const setTrigramThresholds = async (tx: {
  execute: (query: SQL) => Promise<unknown>;
}): Promise<void> => {
  const similarityThreshold = String(1 - TRIGRAM_DISTANCE_THRESHOLD);
  const wordSimilarityThreshold = String(WORD_SIMILARITY_THRESHOLD);
  await tx.execute(
    sql`SELECT set_config('pg_trgm.similarity_threshold', ${similarityThreshold}, true)`
  );
  await tx.execute(
    sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${wordSimilarityThreshold}, true)`
  );
};
