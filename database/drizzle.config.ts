import { defineConfig } from 'drizzle-kit';
import { loadEnv } from '@rcr/lib/env';

loadEnv();

export default defineConfig({
	out: './migrations/main',
	schema: ['./schema/main', './schema/integrations'],
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	casing: 'snake_case',
});
