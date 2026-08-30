import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Layer, Result } from 'effect';
import { z } from 'zod';
import { DbError } from './errors';
import {
  forEachCollect,
  requireRunId,
  RunTracker,
  withRun,
  type RunCompletion,
  type SyncSummary,
} from './run';
import { decodeZod } from './zod';

const STUB_RUN_ID = 42;

const makeTrackerStub = () => {
  const finishes: Array<{ runId: number; fields: RunCompletion }> = [];
  const layer = Layer.succeed(RunTracker, {
    start: () => Effect.succeed(STUB_RUN_ID),
    finish: (runId, fields) =>
      Effect.sync(() => {
        finishes.push({ runId, fields });
      }),
  });
  return { finishes, layer };
};

describe('withRun', () => {
  test('records success with entriesCreated and provides the run id', async () => {
    const stub = makeTrackerStub();
    const work = Effect.gen(function* () {
      const runId = yield* requireRunId;
      expect(runId).toBe(STUB_RUN_ID);
      return { entriesCreated: 3, failures: [] } satisfies SyncSummary;
    });
    const summary = await Effect.runPromise(
      withRun('readwise', work).pipe(Effect.provide(stub.layer))
    );
    expect(summary.entriesCreated).toBe(3);
    expect(stub.finishes).toHaveLength(1);
    const finish = stub.finishes[0];
    expect(finish?.runId).toBe(STUB_RUN_ID);
    expect(finish?.fields.status).toBe('success');
    expect(finish?.fields.entriesCreated).toBe(3);
    expect(finish?.fields.message).toBeNull();
  });

  test('surfaces item failures in the success message', async () => {
    const stub = makeTrackerStub();
    const work = Effect.succeed({
      entriesCreated: 1,
      failures: [
        { label: 'a', message: 'boom' },
        { label: 'b', message: 'bang' },
      ],
    } satisfies SyncSummary);
    await Effect.runPromise(withRun('readwise', work).pipe(Effect.provide(stub.layer)));
    expect(stub.finishes[0]?.fields.message).toContain('2 item(s) failed');
    expect(stub.finishes[0]?.fields.message).toContain('a: boom');
  });

  test('records failure with a readable message when the work fails', async () => {
    const stub = makeTrackerStub();
    const work = Effect.fail(new DbError({ operation: 'staging.upsert', cause: 'nope' }));
    const result = await Effect.runPromise(
      withRun('readwise', work).pipe(Effect.result, Effect.provide(stub.layer))
    );
    expect(Result.isFailure(result)).toBe(true);
    expect(stub.finishes).toHaveLength(1);
    expect(stub.finishes[0]?.fields.status).toBe('fail');
    expect(stub.finishes[0]?.fields.message).toContain('staging.upsert');
  });

  test('records failure with "Interrupted" when the run is interrupted', async () => {
    const stub = makeTrackerStub();
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(withRun('readwise', Effect.never));
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);
    });
    await Effect.runPromise(program.pipe(Effect.provide(stub.layer)));
    expect(stub.finishes).toHaveLength(1);
    expect(stub.finishes[0]?.fields.status).toBe('fail');
    expect(stub.finishes[0]?.fields.message).toBe('Interrupted');
  });
});

describe('forEachCollect', () => {
  test('collects failures without aborting the batch', async () => {
    const { successes, failures } = await Effect.runPromise(
      forEachCollect([1, 2, 3, 4], {
        concurrency: 2,
        label: (n) => `item-${n}`,
        worker: (n) =>
          n % 2 === 0
            ? Effect.fail(new DbError({ operation: `op-${n}`, cause: 'even' }))
            : Effect.succeed(n * 10),
      })
    );
    expect(successes).toEqual([10, 30]);
    expect(failures.map((f) => f.label)).toEqual(['item-2', 'item-4']);
    expect(failures[0]?.message).toContain('op-2');
  });

  test('propagates defects instead of collecting them', async () => {
    const boom = forEachCollect([1], {
      concurrency: 1,
      label: String,
      worker: () =>
        Effect.sync(() => {
          throw new Error('bug, not an item failure');
        }),
    });
    await expect(Effect.runPromise(boom)).rejects.toThrow('bug, not an item failure');
  });
});

describe('decodeZod', () => {
  test('fails with a typed validation error carrying issue paths', async () => {
    const schema = z.object({ items: z.array(z.object({ id: z.number() })) });
    const result = await Effect.runPromise(
      decodeZod(schema, 'test payload')({ items: [{ id: 'nope' }] }).pipe(Effect.result)
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('ApiValidationError');
      expect(result.failure.issues[0]?.path).toEqual(['items', 0, 'id']);
    }
  });
});
