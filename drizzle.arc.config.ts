import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '@/server/db/connections/arc-sqlite';

export default defineConfig({
	out: './migrations/arc',
	schema: './packages/data/src/schema/arc',
	dialect: 'sqlite',
	dbCredentials: {
		url: connectionUrl,
	},
});
