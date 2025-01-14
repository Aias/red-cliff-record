import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Get the correct database URL
const databaseUrl = process.env.DATABASE_URL?.replace(
	'${DATABASE_URL_LOCAL}',
	process.env.DATABASE_URL_LOCAL ?? ''
);

export default defineConfig({
	out: './src/server/db/migrations/main',
	schema: [
		'./src/server/db/schema/main/index.ts',
		'./src/server/db/schema/integrations/index.ts',
		'./src/server/db/schema/operations/index.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl!,
	},
	casing: 'snake_case',
});
