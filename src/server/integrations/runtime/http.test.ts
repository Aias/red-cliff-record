import { describe, expect, test } from 'bun:test';
import { Effect, Fiber, Layer, Redacted, Result } from 'effect';
import { TestClock } from 'effect/testing';
import { HttpClient, HttpClientResponse } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';
import { makeApiClient } from './http';

const makeHttpStub = (respond: (attempt: number) => Response) => {
  let attempts = 0;
  const requests: Array<{ url: string; authorization: string | undefined }> = [];
  const layer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) => {
      attempts++;
      requests.push({ url: request.url, authorization: request.headers['authorization'] });
      return Effect.succeed(HttpClientResponse.fromWeb(request, respond(attempts)));
    })
  );
  return { layer, requests, attempts: () => attempts };
};

const testLayers = (stub: { layer: Layer.Layer<HttpClient.HttpClient> }) =>
  Layer.mergeAll(
    stub.layer,
    RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory)),
    TestClock.layer()
  );

const client = makeApiClient({
  baseUrl: 'https://api.example.com',
  authorization: { scheme: 'Bearer', token: Redacted.make('secret') },
  rateLimit: { key: 'test', limit: 1000, window: '1 minute' },
});

const runWithVirtualTime = <A, E, R>(request: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(request.pipe(Effect.result));
    for (let i = 0; i < 30; i++) {
      yield* TestClock.adjust('10 minutes');
    }
    return yield* Fiber.join(fiber);
  });

describe('makeApiClient', () => {
  test('prepends the base url and sets the auth header', async () => {
    const stub = makeHttpStub(() => new Response('{"ok":true}', { status: 200 }));
    const program = Effect.gen(function* () {
      const api = yield* client;
      return yield* api.get('/things');
    });
    const response = await Effect.runPromise(program.pipe(Effect.provide(testLayers(stub))));
    expect(response.status).toBe(200);
    expect(stub.requests[0]?.url).toBe('https://api.example.com/things');
    expect(stub.requests[0]?.authorization).toBe('Bearer secret');
  });

  test('a persistent 429 fails after a bounded number of attempts', async () => {
    const stub = makeHttpStub(
      () => new Response('rate limited', { status: 429, headers: { 'retry-after': '1' } })
    );
    const program = Effect.gen(function* () {
      const api = yield* client;
      return yield* api.get('/things');
    });
    const result = await Effect.runPromise(
      runWithVirtualTime(program).pipe(Effect.provide(testLayers(stub)))
    );
    expect(Result.isFailure(result)).toBe(true);
    expect(stub.attempts()).toBeGreaterThan(1);
    expect(stub.attempts()).toBeLessThan(50);
  });

  test('a persistent 500 fails after bounded transient retries', async () => {
    const stub = makeHttpStub(() => new Response('oops', { status: 500 }));
    const program = Effect.gen(function* () {
      const api = yield* client;
      return yield* api.get('/things');
    });
    const result = await Effect.runPromise(
      runWithVirtualTime(program).pipe(Effect.provide(testLayers(stub)))
    );
    expect(Result.isFailure(result)).toBe(true);
    expect(stub.attempts()).toBeGreaterThan(1);
    expect(stub.attempts()).toBeLessThan(50);
  });

  test('recovers when a 429 is followed by success', async () => {
    const stub = makeHttpStub((attempt) =>
      attempt === 1
        ? new Response('rate limited', { status: 429, headers: { 'retry-after': '1' } })
        : new Response('{"ok":true}', { status: 200 })
    );
    const program = Effect.gen(function* () {
      const api = yield* client;
      return yield* api.get('/things');
    });
    const result = await Effect.runPromise(
      runWithVirtualTime(program).pipe(Effect.provide(testLayers(stub)))
    );
    expect(Result.isSuccess(result)).toBe(true);
    expect(stub.attempts()).toBe(2);
  });
});
