import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sql';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';

const createDb = () => drizzle(process.env.DATABASE_URL!, { schema, relations });
type Database = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as {
	db: Database | undefined;
};

export const db = globalForDb.db ?? createDb();

if (process.env.NODE_ENV !== 'production') globalForDb.db = db;

export type Db = typeof db;
