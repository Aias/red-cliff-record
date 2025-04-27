import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter } from './init';
import { adminRouter } from './routers/admin';
import { linksRouter } from './routers/links';
import { mediaRouter } from './routers/media';
import { recordsRouter } from './routers/records';

export const appRouter = createTRPCRouter({
	admin: adminRouter,
	media: mediaRouter,
	records: recordsRouter,
	links: linksRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
