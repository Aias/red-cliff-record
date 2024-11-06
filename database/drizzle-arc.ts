import { defineConfig } from 'drizzle-kit';
import { arcDbCopyPath } from './browser-history/constants';

export default defineConfig({
	out: './browser-history/drizzle',
	schema: './browser-history/drizzle/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: arcDbCopyPath
	}
});
