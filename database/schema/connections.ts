import { drizzle } from 'drizzle-orm/node-postgres';

// PostgreSQL (main) connection
export const createPgConnection = () => {
	console.log(process.env.DATABASE_URL, 'DATABASE_URL');
	return drizzle({
		connection: process.env.DATABASE_URL!,
		casing: 'snake_case',
	});
};

// SQLite connection for Arc browser
export const createArcConnection = async () => {
	if (typeof process.versions.bun === 'string') {
		const { default: arcConnection } = await import('./arc/arcConnection');
		return arcConnection();
	}
	throw new Error('Arc connection requires Bun runtime');
};
