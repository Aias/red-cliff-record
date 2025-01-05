import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from '../schema';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.REMOTE_DATABASE_URL!,
		casing: 'snake_case',
		schema,
	});
};

export type PgConnection = ReturnType<typeof createPgConnection>;

export const db = createPgConnection();
