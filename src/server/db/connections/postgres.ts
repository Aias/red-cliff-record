import { relations, schema } from '@aias/hozo';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sql';

const createDb = () =>
	drizzle({
		connection: {
			url: Bun.env.DATABASE_URL!,
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

if (Bun.env.NODE_ENV !== 'production') globalForDb.db = db;

export type Db = typeof db;
