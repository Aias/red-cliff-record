import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	out: './src/server/db/migrations/main',
	schema: [
		'./src/server/db/schema/main/index.ts',
		'./src/server/db/schema/integrations/index.ts',
		'./src/server/db/schema/operations/index.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.REMOTE_DATABASE_URL!,
	},
	casing: 'snake_case',
});
