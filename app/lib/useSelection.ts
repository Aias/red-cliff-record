import { useState } from 'react';

export function useSelection<T extends { id: string }>(items: T[]) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	// Function overload signatures
	function toggleSelection(id: string): void;
	function toggleSelection(ids: string[]): void;
	function toggleSelection(idOrIds: string | string[]) {
		setSelectedIds((prev) => {
			const next = new Set(prev);

			if (Array.isArray(idOrIds)) {
				// Handle array of ids
				idOrIds.forEach((id) => {
					if (next.has(id)) {
						next.delete(id);
					} else {
						next.add(id);
					}
				});
			} else {
				// Handle single id
				if (next.has(idOrIds)) {
					next.delete(idOrIds);
				} else {
					next.add(idOrIds);
				}
			}

			return next;
		});
	}

	const selectAll = (predicate?: (item: T) => boolean) => {
		setSelectedIds(
			new Set(items.filter((item) => (predicate ? predicate(item) : true)).map((item) => item.id))
		);
	};

	const clearSelection = (predicate?: (item: T) => boolean) => {
		if (!predicate) {
			setSelectedIds(new Set());
			return;
		}

		setSelectedIds((prev) => {
			const next = new Set(prev);
			items.forEach((item) => {
				if (predicate(item) && next.has(item.id)) {
					next.delete(item.id);
				}
			});
			return next;
		});
	};

	return {
		selectedIds,
		toggleSelection,
		clearSelection,
		selectAll,
	};
}
