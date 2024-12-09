import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '@rcr/lib/env';
import * as github from '../integrations/github/schema';

loadEnv();
loadEnv();

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case',
		schema: {
			...github,
		},
	});
};

export type PgConnection = ReturnType<typeof createPgConnection>;
