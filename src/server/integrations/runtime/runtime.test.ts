import { expect, test } from 'bun:test';
import { Deferred, Effect } from 'effect';
import { runAppEffect } from './runtime';

test('runAppEffect interrupts the root effect through its abort signal', async () => {
  const acquired = await Effect.runPromise(Deferred.make<void>());
  const controller = new AbortController();
  let released = false;
  const program = Effect.acquireRelease(Deferred.succeed(acquired, undefined), () =>
    Effect.sync(() => {
      released = true;
    })
  ).pipe(
    Effect.flatMap(() => Effect.never),
    Effect.scoped
  );
  const result = runAppEffect(program, controller.signal);
  await Effect.runPromise(Deferred.await(acquired));
  controller.abort();
  await expect(result).rejects.toThrow('Interrupted');
  expect(released).toBe(true);
});
