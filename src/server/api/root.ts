import { githubRouter } from './routers/github';
import { browserHistoryRouter, omitListRouter } from './routers/history';
import { createTRPCRouter } from './init';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	github: githubRouter,
	history: browserHistoryRouter,
	omitList: omitListRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
