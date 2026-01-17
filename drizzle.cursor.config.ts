import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '@/server/db/connections/cursor-sqlite';

export default defineConfig({
  out: './migrations/cursor',
  schema: './packages/hozo/src/schema/cursor',
  dialect: 'sqlite',
  dbCredentials: {
    url: connectionUrl,
  },
});
