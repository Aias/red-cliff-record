import 'dotenv/config';
// TODO: Use Bun's native postgres client when it's a bit more stable: https://orm.drizzle.team/docs/get-started/bun-sql-new
// Note: Will also need to work with Tanstack Start. Probably after Start removes Vinxi dependency: https://tanstack.com/router/latest/docs/framework/react/start/build-from-scratch#install-dependencies
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
