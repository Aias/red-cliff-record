import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as integrationsSchema from '~//db/schema/integrations';
import * as mainSchema from '~//db/schema/main';
import * as operationsSchema from '~//db/schema/operations';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.REMOTE_DATABASE_URL!,
		casing: 'snake_case',
		schema: {
			...mainSchema,
			...integrationsSchema,
			...operationsSchema,
		},
	});
};

export type PgConnection = ReturnType<typeof createPgConnection>;

export const db = createPgConnection();
