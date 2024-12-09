import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '@rcr/lib/env';

import * as integrationsSchema from '../integrations/schema';
import * as mainSchema from '../main/schema';
import * as operationsSchema from '../operations/schema';

loadEnv();
loadEnv();

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case',
		schema: {
			...integrationsSchema,
			...mainSchema,
			...operationsSchema,
		},
	});
};

export type PgConnection = ReturnType<typeof createPgConnection>;
