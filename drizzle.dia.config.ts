import { defineConfig } from 'drizzle-kit';
import { connectionUrl } from '@/server/db/connections/dia-sqlite';

export default defineConfig({
  out: './migrations/dia',
  schema: './packages/hozo/src/schema/dia',
  dialect: 'sqlite',
  dbCredentials: {
    url: connectionUrl,
  },
});
