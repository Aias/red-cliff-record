import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './db/migrations/main',
	schema: [
		'./db/schema/main/schema.ts',
		'./db/schema/operations/schema.ts',
		'./db/schema/integrations/schema.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.REMOTE_DATABASE_URL!,
	},
	casing: 'snake_case',
});
