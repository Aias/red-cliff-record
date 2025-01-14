import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as integrationsSchema from '~/server/db/schema/integrations';
import * as mainSchema from '~/server/db/schema/main';
import * as operationsSchema from '~/server/db/schema/operations';

const schema = {
	...mainSchema,
	...integrationsSchema,
	...operationsSchema,
};

const globalForDb = globalThis as unknown as {
	conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(process.env.DATABASE_URL!);
if (process.env.NODE_ENV !== 'production') globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
