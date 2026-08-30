import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations/dia',
  schema: './packages/hozo/src/schema/dia',
  dialect: 'sqlite',
  dbCredentials: {
    url: `file:${process.env.HOME}/Library/Application Support/Dia/User Data/Default/History-copy`,
  },
});
