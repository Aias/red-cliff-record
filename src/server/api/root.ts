import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter } from './init';
import { adminRouter } from './routers/admin';
import { linksRouter } from './routers/links';
import { mediaRouter } from './routers/media';
import { recordsRouter } from './routers/records';
import { searchRouter } from './routers/search';

export const appRouter = createTRPCRouter({
	admin: adminRouter,
	links: linksRouter,
	media: mediaRouter,
	records: recordsRouter,
	search: searchRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
