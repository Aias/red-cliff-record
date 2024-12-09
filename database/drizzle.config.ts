import { defineConfig } from 'drizzle-kit';
import { loadEnv } from '@rcr/lib/env';

loadEnv();

export default defineConfig({
	out: './migrations/main',
	schema: [
		'./schema/main/schema.ts',
		'./schema/operations/schema.ts',
		'./schema/integrations/schema.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	casing: 'snake_case',
});
