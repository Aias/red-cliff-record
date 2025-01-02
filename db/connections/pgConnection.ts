import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';

import * as integrationsSchema from '../schema/integrations/schema';
import * as mainSchema from '../schema/main/schema';
import * as operationsSchema from '../schema/operations/schema';

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
