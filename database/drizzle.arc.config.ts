import { defineConfig } from 'drizzle-kit';
import { arcDbCopyPath } from './schema/constants';

export default defineConfig({
	out: './migrations/arc',
	schema: './schema/arc',
	dialect: 'sqlite',
	dbCredentials: {
		url: arcDbCopyPath
	}
});
