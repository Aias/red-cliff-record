import { relations } from '@hozo';
import { zeroDrizzle } from '@rocicorp/zero/server/adapters/drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import { getDatabaseUrl } from '@/server/lib/db-url';
import { schema } from '@/shared/zero/schema.gen';

/* Dedicated postgres.js connection: Zero's mutation-result cleanup binds
 * `"clientID" = ANY($2)` with a string array, which Bun's native driver sends
 * as a braceless comma-joined string that Postgres rejects ("malformed array
 * literal"). postgres.js serializes array parameters correctly.
 * TODO: reuse the shared bun-sql connection (@/server/db/connections/postgres)
 * once Bun fixes array bind parameters (oven-sh/bun#18775). */
const createDb = () =>
  drizzle({
    connection: { url: getDatabaseUrl(), connect_timeout: 5 },
    relations,
  });

const globalForZeroDb = globalThis as unknown as {
  zeroPg: ReturnType<typeof createDb> | undefined;
};

const zeroPg = globalForZeroDb.zeroPg ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForZeroDb.zeroPg = zeroPg;

/** ZQL-capable wrapper around the app database for server-side Zero mutators. */
export const zeroDb = zeroDrizzle(schema, zeroPg);

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof zeroDb;
  }
}
