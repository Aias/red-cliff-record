import { sql, type Column, type SQL } from 'drizzle-orm';

export const SIMILARITY_THRESHOLD = 0.8; // Cosine similarity floor (higher = stricter)
/** Max same-URL records pinned as duplicate candidates; larger clusters are junk (platform root URLs), not identity signals. */
export const URL_DUPLICATE_CANDIDATE_LIMIT = 2;
/** pg_trgm similarity floor for treating two titles as the same title spelled differently.
 * Above it sit variants of one name; below it sit records that merely share a common word. */
export const TITLE_VARIANT_SIMILARITY = 0.6;
export const TRIGRAM_DISTANCE_THRESHOLD = 0.75; // pg_trgm distance ceiling (lower = stricter)
export const WORD_SIMILARITY_THRESHOLD = 0.5; // pg_trgm word_similarity floor for phrase matching
export const WORD_SIMILARITY_DISTANCE_THRESHOLD = 1 - WORD_SIMILARITY_THRESHOLD;

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

/** Strip protocol, www, and trailing slashes so URLs compare by identity. */
export const normalizeUrl = (url: string | null | undefined): string | null => {
  if (!url) {
    return null;
  }
  const normalized = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : null;
};

/** The same URL normalization as `normalizeUrl`, applied to a column. */
export const normalizedUrlColumn = (column: Column): SQL =>
  sql`lower(regexp_replace(${column}, '^https?://(www\\.)?|/+$', '', 'g'))`;

/** Strip case and collapse whitespace so titles compare by identity. */
export const normalizeTitle = (title: string | null | undefined): string | null => {
  if (!title) {
    return null;
  }
  const normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : null;
};

/** The same title normalization as `normalizeTitle`, applied to a column. */
export const normalizedTitleColumn = (column: Column): SQL =>
  sql`btrim(lower(regexp_replace(${column}, '\\s+', ' ', 'g')))`;

/**
 * Tiered agreement with a seed title: 2 = the same title, 1 = a spelling
 * variant, 0 = unrelated (every record, when the seed has no title). Two
 * records sharing a title is a far stronger duplicate signal than the cosine
 * distance between them, because sparse records embed mostly as their
 * template — a bare name under a heading — and so sit closer to every other
 * sparse record than to a fully populated record describing the same subject.
 */
export const titleMatchTier = (column: Column, normalizedTitle: string | null): SQL<number> =>
  normalizedTitle === null
    ? // The cast keeps ORDER BY from reading the bare constant as a column position.
      sql<number>`(0::int)`
    : sql<number>`CASE
        WHEN ${normalizedTitleColumn(column)} = ${normalizedTitle} THEN 2
        WHEN similarity(${column}, ${normalizedTitle}) >= ${TITLE_VARIANT_SIMILARITY} THEN 1
        ELSE 0
      END`;

/** Queries containing a dot or slash may be URLs or domains; only those should match against the url column. */
const asUrlQuery = (query: string): string | null =>
  /[./]/.test(query) ? normalizeUrl(query) : null;

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
 * Tiered exactness for ranking: 0 = exact title/abbreviation/URL match,
 * 1 = title prefix, 2 = title/abbreviation/URL substring, 3 = everything else.
 * Keeps literal matches ahead of fuzzy and semantic ones. URL tiers apply
 * only to URL-shaped queries so slug fragments don't outrank real matches.
 */
export const exactMatchTier = (
  columns: { title: Column; abbreviation: Column; url: Column },
  query: string
): SQL<number> => {
  const escaped = escapeLikePattern(query.trim());
  const urlQuery = asUrlQuery(query);
  const urlExact = urlQuery ? sql`${normalizedUrlColumn(columns.url)} = ${urlQuery}` : sql`false`;
  const urlSubstring = urlQuery
    ? sql`${columns.url} ILIKE ${`%${escapeLikePattern(urlQuery)}%`}`
    : sql`false`;
  return sql<number>`CASE
    WHEN lower(${columns.title}) = lower(${query}) OR lower(${columns.abbreviation}) = lower(${query}) OR ${urlExact} THEN 0
    WHEN ${columns.title} ILIKE ${`${escaped}%`} THEN 1
    WHEN ${columns.title} ILIKE ${`%${escaped}%`} OR ${columns.abbreviation} ILIKE ${`%${escaped}%`} OR ${urlSubstring} THEN 2
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
    url: Column;
    textSearch: Column;
  },
  query: string
): SQL => {
  const substring = `%${escapeLikePattern(query.trim())}%`;
  const urlQuery = asUrlQuery(query);
  const urlCondition = urlQuery
    ? sql`${columns.url} ILIKE ${`%${escapeLikePattern(urlQuery)}%`}`
    : sql`false`;
  return sql`(
    ${columns.textSearch} @@ ${toTsQuery(query)} OR
    ${urlCondition} OR
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
