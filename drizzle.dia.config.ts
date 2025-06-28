import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '@/server/db/connections/dia-sqlite';

export default defineConfig({
	out: './migrations/dia',
	schema: './src/server/db/schema/dia',
	dialect: 'sqlite',
	dbCredentials: {
		url: connectionUrl,
	},
});
