import { createStartAPIHandler } from '@tanstack/start/api';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/server/api/init';
import { appRouter } from '@/server/api/root';

export default createStartAPIHandler(async ({ request }) => {
	return fetchRequestHandler({
		endpoint: '/trpc',
		req: request,
		router: appRouter,
		createContext: async () =>
			createTRPCContext({
				headers: request.headers,
			}),
	});
});
