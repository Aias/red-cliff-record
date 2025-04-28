import { neon, neonConfig } from '@neondatabase/serverless';
import { initTRPC } from '@trpc/server';
import DataLoader from 'dataloader';
import { drizzle } from 'drizzle-orm/neon-http';
import superjson from 'superjson';
import ws from 'ws';
import { ZodError } from 'zod';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';
import type { RecordGet } from './routers/records.types';

neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true;

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({
	client: sql,
	schema,
	relations,
});

function createRecordLoader() {
	return new DataLoader<number, RecordGet>(async (ids) => {
		const rows = await db.query.records.findMany({
			where: {
				id: {
					in: ids as number[],
				},
			},
			columns: {
				textEmbedding: false,
			},
			with: {
				media: true,
			},
		});

		const byId = new Map(rows.map((r) => [r.id, r]));

		return ids.map((id) => {
			const record = byId.get(id);
			return record ? record : new Error(`Record not found for ID: ${id}`);
		});
	});
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
	return {
		...opts,
		db,
		loaders: {
			record: createRecordLoader(),
		},
	};
};

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

export const mergeRouters = t.mergeRouters;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
	const start = performance.now();
	const result = await next();
	const end = performance.now();
	console.log(`[tRPC] ${path}: ${(end - start).toFixed(2)} ms`);

	return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);
