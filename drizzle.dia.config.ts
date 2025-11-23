import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '@/server/db/connections/dia-sqlite';

export default defineConfig({
	out: './migrations/dia',
	schema: './packages/data/src/schema/dia',
	dialect: 'sqlite',
	dbCredentials: {
		url: connectionUrl,
	},
});
