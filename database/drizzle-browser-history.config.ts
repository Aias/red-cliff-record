import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { dbCopyPath } from './browser-history/constants';

export default defineConfig({
	out: './browser-history/drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: dbCopyPath
	}
});
