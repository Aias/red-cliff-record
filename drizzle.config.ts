import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './src/server/lib/db-url';

const databaseUrl = getDatabaseUrl();

export default defineConfig({
  out: './migrations/main',
  schema: ['./packages/hozo/src/schema/index.ts'],
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl!,
  },
  casing: 'snake_case',
  strict: true,
});
