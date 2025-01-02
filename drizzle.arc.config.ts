import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from './db/connections';

export default defineConfig({
	out: './db/migrations/arc',
	schema: './db/schema/arc',
	dialect: 'sqlite',
	dbCredentials: {
		url: connectionUrl,
	},
});
