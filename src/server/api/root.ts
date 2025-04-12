import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter } from './init';
import { adminRouter } from './routers/admin';
import { mediaRouter } from './routers/media';
import { recordsRouter } from './routers/records';
import { relationsRouter } from './routers/relations';

export const appRouter = createTRPCRouter({
	admin: adminRouter,
	media: mediaRouter,
	records: recordsRouter,
	relations: relationsRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
