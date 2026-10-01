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

test('runAppEffect waits for asynchronous cleanup before rejecting an interrupted effect', async () => {
  const acquired = await Effect.runPromise(Deferred.make<void>());
  const cleanupStarted = await Effect.runPromise(Deferred.make<void>());
  const finishCleanup = await Effect.runPromise(Deferred.make<void>());
  const controller = new AbortController();
  let released = false;
  let settled = false;
  const program = Effect.acquireRelease(Deferred.succeed(acquired, undefined), () =>
    Effect.gen(function* () {
      yield* Deferred.succeed(cleanupStarted, undefined);
      yield* Deferred.await(finishCleanup);
      released = true;
    })
  ).pipe(
    Effect.flatMap(() => Effect.never),
    Effect.scoped
  );
  const result = runAppEffect(program, controller.signal);
  void result.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  await Effect.runPromise(Deferred.await(acquired));
  controller.abort();
  try {
    await Effect.runPromise(Deferred.await(cleanupStarted));
    await Bun.sleep(0);
    expect(settled).toBe(false);
    expect(released).toBe(false);
  } finally {
    await Effect.runPromise(Deferred.succeed(finishCleanup, undefined));
  }
  await expect(result).rejects.toThrow('Interrupted');
  expect(released).toBe(true);
});
