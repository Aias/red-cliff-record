import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './src/db/migrations/main',
	schema: [
		'./src/db/schema/main/index.ts',
		'./src/db/schema/integrations/index.ts',
		'./src/db/schema/operations/index.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.REMOTE_DATABASE_URL!,
	},
	casing: 'snake_case',
});
