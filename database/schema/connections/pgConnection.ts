import { drizzle } from 'drizzle-orm/node-postgres';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	console.log(process.env.DATABASE_URL, 'DATABASE_URL');
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case',
	});
};
