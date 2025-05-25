import { useCallback, useEffect, useRef } from 'react';

export function useAutosave(onSave: () => Promise<void>, delay = 1000) {
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const debouncedSave = useCallback(() => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			void onSave();
		}, delay);
	}, [onSave, delay]);

	const immediateSave = useCallback(async () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		await onSave();
	}, [onSave]);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		const handleBeforeUnload = () => {
			if (timeoutRef.current) {
				void immediateSave();
			}
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [immediateSave]);

	return { debouncedSave, immediateSave };
}
