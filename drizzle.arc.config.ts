import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '~/server/db/connections/arc-sqlite';

export default defineConfig({
	out: './src/server/db/migrations/arc',
	schema: './src/server/db/schema/arc',
	dialect: 'sqlite',
	dbCredentials: {
		url: connectionUrl,
	},
});
