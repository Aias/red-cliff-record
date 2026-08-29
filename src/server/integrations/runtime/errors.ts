import { Data, type Config } from 'effect';
import type { HttpClientError } from 'effect/unstable/http';
import type { RateLimiter } from 'effect/unstable/persistence';
import type { z } from 'zod';

/** A request to an external API failed at the transport or protocol level. */
export class ApiRequestError extends Data.TaggedError('ApiRequestError')<{
  readonly resource: string;
  readonly cause: unknown;
}> {}

/** An external API responded with a payload that failed schema validation. */
export class ApiValidationError extends Data.TaggedError('ApiValidationError')<{
  readonly resource: string;
  readonly issues: ReadonlyArray<z.core.$ZodIssue>;
}> {}

/** A database read or write failed. */
export class DbError extends Data.TaggedError('DbError')<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export type IntegrationError =
  | ApiRequestError
  | ApiValidationError
  | DbError
  | HttpClientError.HttpClientError
  | Config.ConfigError
  | RateLimiter.RateLimiterError;

export const describeError = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    return `API request failed (${error.resource}): ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
  }
  if (error instanceof ApiValidationError) {
    const details = error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    return `API response validation failed (${error.resource}): ${details}`;
  }
  if (error instanceof DbError) {
    return `Database operation failed (${error.operation}): ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`;
  }
  return error instanceof Error ? error.message : String(error);
};
