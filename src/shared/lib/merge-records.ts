import type { RecordSelect } from '@aias/hozo';
import type { RecordGet } from '@/shared/types';

/**
 * Helper function to merge text fields during record merging.
 * Used by both optimistic updates and backend merge operations.
 */
export function mergeTextFields(
  sourceText: string | null,
  targetText: string | null
): string | null {
  const hasSourceText = sourceText && sourceText !== '';
  const hasTargetText = targetText && targetText !== '';

  if (hasSourceText && hasTargetText) {
    // Prefer target text first in merged content
    return `${targetText}\n---\n${sourceText}`;
  } else if (hasTargetText) {
    return targetText;
  } else if (hasSourceText) {
    return sourceText;
  }
  return null;
}

/**
 * Helper function to get the earliest date from two nullable dates
 * @param date1 First date (nullable)
 * @param date2 Second date (nullable)
 * @returns The earliest date, or null if both are null
 */
function getEarliestDate(date1: Date | null, date2: Date | null): Date | null {
  if (date1 && date2) {
    return date1 < date2 ? date1 : date2;
  }
  return date1 || date2;
}

/**
 * Helper function to get the most recent date from two nullable dates
 * @param date1 First date (nullable)
 * @param date2 Second date (nullable)
 * @returns The most recent date, or null if both are null
 */
function getMostRecentDate(date1: Date | null, date2: Date | null): Date | null {
  if (date1 && date2) {
    return date1 > date2 ? date1 : date2;
  }
  return date1 || date2;
}

/**
 * Merges two records, returning the merged record data.
 * This function is used by both optimistic updates and backend operations.
 *
 * @param source The source record (will be deleted)
 * @param target The target record (will survive the merge)
 * @returns Merged record data based on the merge rules
 */
export function mergeRecords<T extends RecordSelect | RecordGet>(
  source: T,
  target: T
): Omit<T, 'id'> & { recordUpdatedAt: Date; textEmbedding: null } {
  // Deduplicate the sources array
  const allSources = Array.from(new Set([...(source.sources ?? []), ...(target.sources ?? [])]));

  // Merge record data, preferring target's non-null (and non-empty string) values
  // but concatenating summary, content, and notes fields
  const mergedRecordData = {
    ...source,
    ...Object.fromEntries(
      Object.entries(target).filter(([key, value]) => {
        // Skip fields handled separately or automatically
        if (
          [
            'id',
            'summary',
            'content',
            'notes',
            'sources',
            'rating',
            'isPrivate',
            'isCurated',
            'recordUpdatedAt',
            'recordCreatedAt',
            'contentCreatedAt',
            'contentUpdatedAt',
            'textEmbedding',
          ].includes(key)
        ) {
          return false;
        }
        // Keep target's value if it's not null or empty string
        return !(value === null || value === '');
      })
    ),
    // Merge text fields
    summary: mergeTextFields(source.summary, target.summary),
    content: mergeTextFields(source.content, target.content),
    notes: mergeTextFields(source.notes, target.notes),
    sources: allSources.length > 0 ? allSources : null,
    rating: Math.max(source.rating, target.rating),
    isPrivate: source.isPrivate || target.isPrivate,
    isCurated: source.isCurated || target.isCurated,
    // Use earliest dates for creation timestamps, most recent for update timestamps
    recordCreatedAt: getEarliestDate(source.recordCreatedAt, target.recordCreatedAt),
    contentCreatedAt: getEarliestDate(source.contentCreatedAt, target.contentCreatedAt),
    contentUpdatedAt: getMostRecentDate(source.contentUpdatedAt, target.contentUpdatedAt),
    recordUpdatedAt: new Date(),
    textEmbedding: null, // Changes require recalculating the embedding
  };

  // Remove id from the result and return
  const { id: _, ...result } = mergedRecordData;
  return result;
}
