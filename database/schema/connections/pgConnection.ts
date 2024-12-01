import { drizzle } from 'drizzle-orm/node-postgres';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case',
	});
};
