// src/routes/api/trpc/$.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTRPCContext } from '@/server/api/init';
import { appRouter } from '@/server/api/root';

const handle = async ({ request }: { request: Request }) =>
	fetchRequestHandler({
		endpoint: '/api/trpc', // must match client url
		req: request,
		router: appRouter,
		createContext: () => createTRPCContext({ headers: request.headers }),
	});

export const ServerRoute = createServerFileRoute('/api/trpc/$').methods({
	GET: handle, // queries
	POST: handle, // mutations
});
