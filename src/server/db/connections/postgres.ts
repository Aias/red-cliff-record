import { relations, schema } from '@hozo';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sql';
import { getDatabaseUrl } from '@/server/lib/db-url';

const createDb = () =>
  drizzle({
    connection: {
      url: getDatabaseUrl(),
      connectionTimeout: 5,
    },
    schema,
    relations,
  });
type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as {
  db: Database | undefined;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export type Db = typeof db;

/** Verify the database is reachable. Throws with a user-friendly message on failure. */
export async function checkDatabaseConnection() {
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    const url = getDatabaseUrl();
    const host = new URL(url).hostname;
    throw new Error(
      `Cannot connect to database (${host}). Check that the host is reachable and the database is running.`
    );
  }
}
