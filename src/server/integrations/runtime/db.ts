import { Context, Effect, Layer } from 'effect';
import { db, type Db } from '@/server/db/connections/postgres';
import { DbError } from './errors';

/**
 * Access to the shared Drizzle client. Integrations never own the connection's
 * lifecycle — the same client serves tRPC and the rest of the server.
 */
export class Database extends Context.Service<
  Database,
  {
    readonly use: <A>(
      operation: string,
      run: (client: Db) => PromiseLike<A>
    ) => Effect.Effect<A, DbError>;
  }
>()('integrations/Database') {}

export const databaseLayer = Layer.succeed(Database, {
  use: (operation, run) =>
    Effect.tryPromise({
      try: () => run(db),
      catch: (cause) => new DbError({ operation, cause }),
    }),
});
