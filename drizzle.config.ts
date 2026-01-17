import { defineConfig } from 'drizzle-kit';

// Get the correct database URL
const databaseUrl = process.env.DATABASE_URL?.replace(
  '${DATABASE_URL_LOCAL}',
  process.env.DATABASE_URL_LOCAL ?? ''
).replace('${DATABASE_URL_REMOTE}', process.env.DATABASE_URL_REMOTE ?? '');

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
