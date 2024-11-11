import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './migrations/main',
	schema: './schema/main.ts',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!
	},
	casing: 'snake_case'
});
