import { useMemo } from 'react';
import { trpc } from '@/app/trpc';
import { useDebounce } from './use-debounce';

interface UseRecordSearchOptions {
	/** Debounce delay in milliseconds (default: 300) */
	debounceMs?: number;
	/** Minimum query length to trigger search (default: 1) */
	minQueryLength?: number;
	/** Maximum text search results (default: 10) */
	textLimit?: number;
	/** Maximum vector search results (default: 5) */
	vectorLimit?: number;
}

/**
 * Combined text + semantic search hook with automatic deduplication.
 *
 * Text results appear first (more precise matches), and vector results
 * are filtered to exclude any records already in text results.
 */
export function useRecordSearch(query: string, options: UseRecordSearchOptions = {}) {
	const { debounceMs = 300, minQueryLength = 1, textLimit = 10, vectorLimit = 5 } = options;

	const debouncedQuery = useDebounce(query, debounceMs);
	const shouldSearch = debouncedQuery.length >= minQueryLength;

	const { data: textResults = [], isFetching: textFetching } = trpc.search.byTextQuery.useQuery(
		{ query: debouncedQuery, limit: textLimit },
		{
			enabled: shouldSearch,
			trpc: {
				context: {
					skipBatch: true,
				},
			},
		}
	);

	const { data: vectorResults = [], isFetching: vectorFetching } = trpc.search.byVector.useQuery(
		{ query: debouncedQuery, limit: vectorLimit },
		{
			enabled: shouldSearch,
			trpc: {
				context: {
					skipBatch: true,
				},
			},
		}
	);

	// Deduplicate: remove vector results that already appear in text results
	const dedupedVectorResults = useMemo(() => {
		const textIds = new Set(textResults.map((r) => r.id));
		return vectorResults.filter((r) => !textIds.has(r.id));
	}, [textResults, vectorResults]);

	const isLoading = textFetching || vectorFetching;
	const hasResults = textResults.length > 0 || dedupedVectorResults.length > 0;

	return {
		textResults,
		vectorResults: dedupedVectorResults,
		textFetching,
		vectorFetching,
		isLoading,
		hasResults,
		shouldSearch,
	};
}
