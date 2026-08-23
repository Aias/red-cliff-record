import { PREDICATES, type RecordSelect } from '@hozo';
import type { FullRecord } from '@/shared/types/domain';

/**
 * Record columns that contribute to embedding text.
 * Constrained to real column names via `satisfies`. Used by `bulkUpdate`
 * to decide whether an update should invalidate the embedding.
 */
export const EMBEDDING_RECORD_FIELDS = [
  'title',
  'abbreviation',
  'sense',
  'content',
  'summary',
  'notes',
  'mediaCaption',
] as const satisfies readonly (keyof RecordSelect)[];

type EmbeddingRecordFields = (typeof EMBEDDING_RECORD_FIELDS)[number];

/** Record data needed for embedding — record columns + relations. */
type EmbeddingRecord = Pick<RecordSelect, EmbeddingRecordFields> & {
  outgoingLinks: FullRecord['outgoingLinks'];
  incomingLinks: FullRecord['incomingLinks'];
  media: FullRecord['media'];
};

const truncateText = (text: string, maxLength: number = 200) => {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
};

const trimBreaks = (text: string) => {
  return text.replace(/\n/g, ' ').trim();
};

export const getRecordTitle = (
  record: Pick<RecordSelect, 'title' | 'abbreviation' | 'sense' | 'content' | 'summary'>,
  maxLength: number = 200
) => {
  const { title, abbreviation, sense, content, summary } = record;

  if (title) {
    const titleParts = [title];
    if (abbreviation) {
      titleParts.push(`(${abbreviation})`);
    }
    if (sense) {
      titleParts.push(`*${sense}*`);
    }
    return titleParts.join(' ');
  }

  if (summary) {
    return truncateText(trimBreaks(summary), maxLength);
  }

  if (content) {
    return truncateText(trimBreaks(content), maxLength);
  }

  return 'Untitled Record';
};

/**
 * Join items with appropriate separator based on count.
 * Short lists use comma separation; longer lists use newlines.
 */
const joinList = (items: string[], threshold = 4): string => {
  if (items.length <= threshold) {
    return items.join(', ');
  }
  return items.join('\n- ');
};

/**
 * Create embedding text for a record.
 *
 * Structure prioritizes semantic content first, then relationships and metadata.
 * This ordering helps embedding models weight substance over structural metadata.
 *
 * Structural identifiers (format links, identity links, source URLs) are
 * deliberately excluded: they describe where a record came from rather than
 * what it says, and including them clusters records by platform (e.g., all
 * tweets near all tweets) instead of by meaning.
 *
 * Relation lines lead with the record's own title rather than a bare label
 * for the same reason: in a sparse record the label is most of the document,
 * so two unrelated entities that both read "Creator of: …" embed closer to
 * each other than to a fully populated record about the same subject.
 * Repeating the title keeps identity tokens, not shared scaffolding,
 * dominant in the vector.
 */
export const createRecordEmbeddingText = (record: EmbeddingRecord) => {
  const { title, content, summary, notes, mediaCaption, outgoingLinks, incomingLinks, media } =
    record;

  // Extract relationships by predicate type
  const creators = outgoingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'creation')
    .map((link) => link.target);
  const created = incomingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'creation')
    .map((link) => link.source);
  const parents = outgoingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'containment')
    .map((link) => link.target);
  const children = incomingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'containment')
    .map((link) => link.source);
  const references = outgoingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'reference')
    .map((link) => link.target);
  const referencedBy = incomingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'reference')
    .map((link) => link.source);
  const associations = outgoingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'association')
    .map((link) => link.target);
  const tags = outgoingLinks
    .filter((link) => PREDICATES[link.predicate].type === 'description')
    .map((link) => link.target);

  const parts: string[] = [];

  const relationLine = (subjectPhrase: string, barePhrase: string, titles: string[]) =>
    title ? `${title} ${subjectPhrase}: ${joinList(titles)}` : `${barePhrase}: ${joinList(titles)}`;

  // === PRIMARY CONTENT (highest semantic value) ===

  // Title with context
  if (title) {
    const titleLine = getRecordTitle(record);
    if (creators.length > 0) {
      parts.push(`# ${titleLine} by ${creators.map((c) => getRecordTitle(c)).join(', ')}`);
    } else {
      parts.push(`# ${titleLine}`);
    }
  }

  // Parent context (where this content comes from)
  if (parents.length > 0) {
    parts.push(
      relationLine(
        'is from',
        'From',
        parents.map((p) => getRecordTitle(p))
      )
    );
  }

  // Core content
  if (summary) {
    parts.push(`**${summary}**`);
  }
  if (content) {
    parts.push(content);
  }

  // Visual content descriptions
  if (mediaCaption && media.length > 0) {
    parts.push(mediaCaption);
  }
  const altTexts = media.map((m) => m.altText).filter(Boolean) as string[];
  if (altTexts.length > 0) {
    parts.push(`Images: ${joinList(altTexts)}`);
  }

  // Child content (excerpts, highlights, etc.)
  if (children.length > 0) {
    const childTitles = children.map((c) => getRecordTitle(c, 500));
    parts.push(relationLine('contains', 'Contains', childTitles));
  }

  // Notes (user annotations)
  if (notes) {
    parts.push(`Note: ${notes}`);
  }

  // === RELATIONSHIPS (semantic connections) ===

  if (references.length > 0) {
    const refTitles = references.map((r) => getRecordTitle(r));
    parts.push(relationLine('references', 'References', refTitles));
  }
  if (referencedBy.length > 0) {
    const refByTitles = referencedBy.map((r) => getRecordTitle(r));
    parts.push(relationLine('is referenced by', 'Referenced by', refByTitles));
  }
  if (associations.length > 0) {
    const assocTitles = associations.map((a) => getRecordTitle(a));
    parts.push(relationLine('is related to', 'Related', assocTitles));
  }
  if (tags.length > 0) {
    const tagTitles = tags.map((t) => getRecordTitle(t));
    parts.push(relationLine('is tagged', 'Tags', tagTitles));
  }
  if (created.length > 0) {
    const createdTitles = created.map((c) => getRecordTitle(c));
    parts.push(relationLine('created', 'Creator of', createdTitles));
  }

  return parts.join('\n\n');
};
