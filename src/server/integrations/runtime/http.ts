import { Effect, Redacted, Schedule, type Duration } from 'effect';
import { HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';

const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_TRANSIENT_RETRIES = 3;

export const makeApiClient = (options: {
  readonly baseUrl: string;
  readonly authorization: {
    readonly scheme: 'Basic' | 'Bearer' | 'Token';
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
          times: MAX_RATE_LIMIT_RETRIES,
        }),
      HttpClient.filterStatusOk,
      HttpClient.retryTransient({
        schedule: Schedule.exponential('1 second').pipe(Schedule.jittered),
        times: MAX_TRANSIENT_RETRIES,
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
