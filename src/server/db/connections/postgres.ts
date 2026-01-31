import { relations, schema } from '@hozo';
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
