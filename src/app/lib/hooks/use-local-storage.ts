import { useEffect, useState } from 'react';

export function useLocalStorage<T>(
	key: string,
	defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
	const [storedValue, setStoredValue] = useState<T>(defaultValue);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		try {
			const item = window.localStorage.getItem(key);
			if (item !== null) {
				setStoredValue(JSON.parse(item) as T);
			}
		} catch {
			// Ignore read errors
		}
	}, [key]);

	const setValue = (value: T | ((prev: T) => T)) => {
		setStoredValue((prev) => {
			const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
			if (typeof window !== 'undefined') {
				try {
					window.localStorage.setItem(key, JSON.stringify(newValue));
				} catch {
					// Ignore write errors
				}
			}
			return newValue;
		});
	};

	return [storedValue, setValue];
}
