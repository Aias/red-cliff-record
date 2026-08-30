import { Effect } from 'effect';
import type { z } from 'zod';
import { ApiValidationError } from './errors';

export const decodeZod =
  <T>(schema: z.ZodType<T>, resource: string) =>
  (input: unknown): Effect.Effect<T, ApiValidationError> => {
    const result = schema.safeParse(input);
    return result.success
      ? Effect.succeed(result.data)
      : Effect.fail(new ApiValidationError({ resource, issues: result.error.issues }));
  };
