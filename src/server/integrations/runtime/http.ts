import { Effect, Redacted, Schedule, type Duration } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';

/**
 * Builds a per-API HTTP client: proactive rate limiting keyed per API, with
 * automatic 429 retries that honor Retry-After (capped — the limiter retries
 * without bound by default), transient-error retries with jittered backoff,
 * and auth on every request.
 */
export const makeApiClient = (options: {
  readonly baseUrl: string;
  readonly authorization: {
    readonly scheme: 'Bearer' | 'Token';
    readonly token: Redacted.Redacted<string>;
  };
  readonly rateLimit: {
    readonly key: string;
    readonly limit: number;
    readonly window: Duration.Input;
  };
}) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.RateLimiter;
    const base = yield* HttpClient.HttpClient;
    return base.pipe(
      (client) =>
        HttpClient.withRateLimiter(client, {
          limiter,
          key: options.rateLimit.key,
          limit: options.rateLimit.limit,
          window: options.rateLimit.window,
          times: 5,
        }),
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({
        schedule: Schedule.exponential('1 second').pipe(Schedule.jittered),
        times: 3,
      }),
      HttpClient.mapRequest(HttpClientRequest.prependUrl(options.baseUrl)),
      HttpClient.mapRequest(
        HttpClientRequest.setHeader(
          'Authorization',
          `${options.authorization.scheme} ${Redacted.value(options.authorization.token)}`
        )
      )
    );
  });
