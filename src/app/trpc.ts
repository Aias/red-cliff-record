import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '~/server/api/root';
import superjson from 'superjson';

function getBaseUrl() {
	if (typeof window !== 'undefined') return window.location.origin;
	return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const trpc = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			// since we are using Vinxi, the server is running on the same port,
			// this means in dev the url is `http://localhost:3000/trpc`
			// and since its from the same origin, we don't need to explicitly set the full URL
			url: `${getBaseUrl()}/trpc`,
			transformer: superjson,
		}),
	],
});

export type TRPCClient = typeof trpc;
