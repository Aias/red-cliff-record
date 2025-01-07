import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './db/migrations/main',
	schema: [
		'./db/schema/main/index.ts',
		'./db/schema/integrations/index.ts',
		'./db/schema/operations/index.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.REMOTE_DATABASE_URL!,
	},
	casing: 'snake_case',
});
