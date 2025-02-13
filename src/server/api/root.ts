import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter } from './init';
import { githubRouter } from './routers/github';
import { historyRouter } from './routers/history';
import { indicesRouter } from './routers/indices';
import { mediaRouter } from './routers/media';
import { recordsRouter } from './routers/records';
import { relationsRouter } from './routers/relations';

export const appRouter = createTRPCRouter({
	github: githubRouter,
	history: historyRouter,
	indices: indicesRouter,
	media: mediaRouter,
	records: recordsRouter,
	relations: relationsRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
