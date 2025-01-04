import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';

import * as integrationsSchema from '../schema/integrations';
import * as mainSchema from '../schema/main';
import * as operationsSchema from '../schema/operations';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.REMOTE_DATABASE_URL!,
		casing: 'snake_case',
		schema: {
			...integrationsSchema,
			...mainSchema,
			...operationsSchema,
		},
	});
};

export type PgConnection = ReturnType<typeof createPgConnection>;

export const db = createPgConnection();
