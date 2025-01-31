import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { createTRPCRouter } from './init';
import { adobeRouter } from './routers/adobe';
import { airtableRouter } from './routers/airtable';
import { githubRouter } from './routers/github';
import { historyRouter } from './routers/history';
import { indicesRouter } from './routers/indices';
import { mediaRouter } from './routers/media';
import { raindropRouter } from './routers/raindrop';
import { readwiseRouter } from './routers/readwise';
import { recordsRouter } from './routers/records';
import { twitterRouter } from './routers/twitter';

export const appRouter = createTRPCRouter({
	adobe: adobeRouter,
	airtable: airtableRouter,
	github: githubRouter,
	history: historyRouter,
	indices: indicesRouter,
	media: mediaRouter,
	raindrop: raindropRouter,
	readwise: readwiseRouter,
	records: recordsRouter,
	twitter: twitterRouter,
});

export type AppRouter = typeof appRouter;

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
