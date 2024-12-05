import { defineConfig } from 'drizzle-kit';
import { loadEnv } from '@rcr/lib/env';

loadEnv();

export default defineConfig({
	out: './migrations/main',
	schema: [
		'./schema/main',
		'./schema/common',
		'./schema/integrations/adobe/schema.ts',
		'./schema/integrations/airtable/schema.ts',
		'./schema/integrations/arc/schema.ts',
		'./schema/integrations/github/schema.ts',
		'./schema/integrations/operations/schema.ts',
		'./schema/integrations/raindrop/schema.ts',
		'./schema/integrations/readwise/schema.ts',
		'./schema/integrations/twitter/schema.ts',
	],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	casing: 'snake_case',
});
