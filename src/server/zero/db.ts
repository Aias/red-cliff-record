import { zeroDrizzle } from '@rocicorp/zero/server/adapters/drizzle';
import { db } from '@/server/db/connections/postgres';
import { schema } from '@/shared/zero/schema.gen';

/** ZQL-capable wrapper around the app database for server-side Zero mutators. */
export const zeroDb = zeroDrizzle(schema, db);

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof zeroDb;
  }
}
