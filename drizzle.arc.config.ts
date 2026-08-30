import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/arc',
  schema: './packages/hozo/src/schema/arc',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${process.env.HOME}/Library/Application Support/Arc/User Data/Default/History-copy`,
  },
});
