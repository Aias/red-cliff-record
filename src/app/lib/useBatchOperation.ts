import { useState } from 'react';
import { type QueryClient } from '@tanstack/react-query';

interface BatchOperationOptions<T, R extends object | void> {
	selectedIds: Set<string>;
	clearSelection: () => void;
	queryClient: QueryClient;
	// Array of query keys to invalidate after operation
	invalidateKeys: string[][];
	// Function to transform selected IDs into operation payload
	prepareData: (ids: string[]) => T;
	// The actual operation to perform
	operation: (options: { data: T }) => Promise<R>;
}

export function useBatchOperation<T, R extends object | void>({
	selectedIds,
	clearSelection,
	queryClient,
	invalidateKeys,
	prepareData,
	operation,
}: BatchOperationOptions<T, R>) {
	const [processing, setProcessing] = useState(false);

	const execute = async () => {
		if (selectedIds.size === 0) return;

		setProcessing(true);
		try {
			const data = prepareData(Array.from(selectedIds));
			const result = await operation({ data });
			invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
			clearSelection();
			return result;
		} catch (error) {
			console.error('Error executing batch operation:', error);
		} finally {
			setProcessing(false);
		}
	};

	return {
		processing,
		execute,
	};
}
