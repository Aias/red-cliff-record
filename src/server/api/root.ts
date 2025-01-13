import { createTRPCRouter } from './init';
import { airtableRouter } from './routers/airtable';
import { githubRouter } from './routers/github';
import { browserHistoryRouter, omitListRouter } from './routers/history';
import { indicesRouter } from './routers/indices';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	airtable: airtableRouter,
	github: githubRouter,
	history: browserHistoryRouter,
	indices: indicesRouter,
	omitList: omitListRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
