import type { QueryClient } from '@tanstack/react-query';

export function invalidateQueries(queryClient: QueryClient, keys: string[][]) {
	return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
}
