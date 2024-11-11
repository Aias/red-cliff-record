import { defineConfig } from 'drizzle-kit';
import { arcDbCopyPath } from './constants';

export default defineConfig({
	out: './migrations/arc',
	schema: './schema/arc.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: arcDbCopyPath
	}
});
