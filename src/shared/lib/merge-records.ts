import type { RecordSelect } from '@/db/schema';
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
		recordUpdatedAt: new Date(),
		textEmbedding: null, // Changes require recalculating the embedding
	};

	// Remove id from the result and return
	const { id: _, ...result } = mergedRecordData;
	return result;
}
