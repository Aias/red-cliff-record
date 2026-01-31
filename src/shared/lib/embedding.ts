import type { RecordSelect } from '@hozo';
import type { FullRecord } from '@/shared/types/domain';

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
 * Extract domain and path from URL, stripping protocol and query params.
 * e.g., "https://example.com/path?q=1" → "example.com/path"
 */
const simplifyUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url;
  }
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
 */
export const createRecordEmbeddingText = (record: FullRecord) => {
  const { title, content, summary, notes, mediaCaption, outgoingLinks, incomingLinks, media, url } =
    record;

  // Extract relationships by predicate type
  const creators = outgoingLinks
    .filter((link) => link.predicate.type === 'creation')
    .map((link) => link.target);
  const created = incomingLinks
    .filter((link) => link.predicate.type === 'creation')
    .map((link) => link.source);
  const formats = outgoingLinks
    .filter((link) => link.predicate.type === 'form')
    .map((link) => link.target);
  const sameAs = outgoingLinks
    .filter((link) => link.predicate.type === 'identity')
    .map((link) => link.target);
  const parents = outgoingLinks
    .filter((link) => link.predicate.type === 'containment')
    .map((link) => link.target);
  const children = incomingLinks
    .filter((link) => link.predicate.type === 'containment')
    .map((link) => link.source);
  const references = outgoingLinks
    .filter((link) => link.predicate.type === 'reference')
    .map((link) => link.target);
  const referencedBy = incomingLinks
    .filter((link) => link.predicate.type === 'reference')
    .map((link) => link.source);
  const associations = outgoingLinks
    .filter((link) => link.predicate.type === 'association')
    .map((link) => link.target);
  const tags = outgoingLinks
    .filter((link) => link.predicate.type === 'description')
    .map((link) => link.target);

  const parts: string[] = [];

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
    parts.push(`From: ${parents.map((p) => getRecordTitle(p)).join(', ')}`);
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
    parts.push(`Contains: ${joinList(childTitles)}`);
  }

  // Notes (user annotations)
  if (notes) {
    parts.push(`Note: ${notes}`);
  }

  // === RELATIONSHIPS (semantic connections) ===

  if (references.length > 0) {
    const refTitles = references.map((r) => getRecordTitle(r));
    parts.push(`References: ${joinList(refTitles)}`);
  }
  if (referencedBy.length > 0) {
    const refByTitles = referencedBy.map((r) => getRecordTitle(r));
    parts.push(`Referenced by: ${joinList(refByTitles)}`);
  }
  if (associations.length > 0) {
    const assocTitles = associations.map((a) => getRecordTitle(a));
    parts.push(`Related: ${joinList(assocTitles)}`);
  }
  if (tags.length > 0) {
    const tagTitles = tags.map((t) => getRecordTitle(t));
    parts.push(`Tags: ${joinList(tagTitles)}`);
  }

  // === METADATA (structural information) ===

  if (created.length > 0) {
    const createdTitles = created.map((c) => getRecordTitle(c));
    parts.push(`Creator of: ${joinList(createdTitles)}`);
  }
  if (formats.length > 0) {
    const formatTitles = formats.map((f) => getRecordTitle(f));
    parts.push(`Format: ${joinList(formatTitles)}`);
  }
  if (sameAs.length > 0) {
    const sameAsTitles = sameAs.map((s) => getRecordTitle(s));
    parts.push(`Same as: ${joinList(sameAsTitles)}`);
  }
  if (url) {
    parts.push(`Source: ${simplifyUrl(url)}`);
  }

  return parts.join('\n\n');
};
