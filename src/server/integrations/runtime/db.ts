import { Context, Effect, Layer } from 'effect';
import { db, type Db } from '@/server/db/connections/postgres';
import { DbError } from './errors';

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

export const legacyOperation = (
  operation: string,
  run: () => Promise<unknown>
): Effect.Effect<void, DbError> =>
  Effect.tryPromise({ try: run, catch: (cause) => new DbError({ operation, cause }) }).pipe(
    Effect.asVoid
  );
