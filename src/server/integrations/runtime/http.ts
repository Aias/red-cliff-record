import { Cause, Effect, Redacted, Schedule, type Duration } from 'effect';
import { HttpClient, HttpClientError, HttpClientRequest } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';

const MAX_RATE_LIMIT_RETRIES = 5;
const MAX_TRANSIENT_RETRIES = 3;
const TRANSIENT_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

const isTransientError = (error: unknown) => {
  if (Cause.isTimeoutError(error)) return true;
  if (!HttpClientError.isHttpClientError(error)) return false;
  if (error.reason._tag === 'TransportError') return true;
  return (
    error.reason._tag === 'StatusCodeError' &&
    TRANSIENT_STATUS_CODES.has(error.reason.response.status)
  );
};

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
  readonly requestTimeout?: Duration.Input;
}) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter.RateLimiter;
    const base = yield* HttpClient.HttpClient;
    const transport = base.pipe(
      HttpClient.transformResponse((request) =>
        options.requestTimeout ? request.pipe(Effect.timeout(options.requestTimeout)) : request
      )
    );
    return transport.pipe(
      (client) =>
        HttpClient.withRateLimiter(client, {
          limiter,
          key: options.rateLimit.key,
          limit: options.rateLimit.limit,
          window: options.rateLimit.window,
          times: MAX_RATE_LIMIT_RETRIES,
        }),
      HttpClient.filterStatusOk,
      HttpClient.retry({
        while: isTransientError,
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
