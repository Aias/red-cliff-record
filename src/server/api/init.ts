import { PREDICATES } from '@hozo';
import { initTRPC } from '@trpc/server';
import DataLoader from 'dataloader';
import superjson from 'superjson';
import { z, ZodError } from 'zod';
import { db } from '@/server/db/connections/postgres';
import type { RecordGet } from '@/shared/types/domain';

/** Predicate slugs for creation and containment types */
const creationContainmentPredicates = Object.values(PREDICATES)
  .filter((p) => p.type === 'creation' || p.type === 'containment')
  .map((p) => p.slug);

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
        outgoingLinks: {
          columns: {
            id: true,
            predicate: true,
            sourceId: true,
            targetId: true,
          },
          with: {
            target: {
              columns: {
                id: true,
                title: true,
              },
            },
          },
          where: {
            predicate: {
              in: creationContainmentPredicates,
            },
          },
        },
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
export const createTRPCContext = (opts: { headers: Headers }) => {
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
        zodError: error.cause instanceof ZodError ? z.treeifyError(error.cause) : null,
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
 * Log aggregation for tRPC requests
 *
 * This buffers logs for a short period (e.g. one tick) and then prints them
 * grouped by procedure path.
 */
const logBuffer = new Map<string, number[]>();
let flushTimeout: Timer | null = null;

const formatTimestamp = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes}:${seconds} ${ampm}`;
};

const SLOW_THRESHOLD_MS = 200;

const flushLogs = () => {
  if (logBuffer.size === 0) return;
  // Suppress logging in CLI context (set by CLI caller)
  if (process.env.RCR_CLI === '1') return;

  const timestamp = formatTimestamp();

  for (const [path, durations] of logBuffer.entries()) {
    const count = durations.length;
    const avg = durations.reduce((a, b) => a + b, 0) / count;
    const max = Math.max(...durations);
    const isSlow = max >= SLOW_THRESHOLD_MS;
    const log = isSlow ? console.warn : console.log;

    if (count > 1) {
      log(
        `${timestamp} [tRPC] ${path} x${count} (avg: ${avg.toFixed(2)}ms, max: ${max.toFixed(2)}ms)`
      );
    } else {
      log(`${timestamp} [tRPC] ${path}: ${durations[0]?.toFixed(2)} ms`);
    }
  }

  logBuffer.clear();
  flushTimeout = null;
};

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
  const duration = end - start;

  // Add to buffer
  const current = logBuffer.get(path) || [];
  current.push(duration);
  logBuffer.set(path, current);

  // Schedule flush if not already scheduled
  if (!flushTimeout) {
    // Flush after a short delay to catch batched requests
    flushTimeout = setTimeout(flushLogs, 50);
  }

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
