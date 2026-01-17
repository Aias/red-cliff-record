import { z } from 'zod';

/**
 * Accepts empty strings and converts them to null, otherwise validates with the schema.
 *
 * @example
 * emptyStringToNull(z.url())    // '' → null, 'https://...' → validated
 * emptyStringToNull(z.string()) // '' → null, 'hello' → 'hello'
 */
export const emptyStringToNull = <T extends z.ZodType>(schema: T) =>
  z.union([z.literal(''), z.null(), schema]).transform((v): z.output<T> | null => v || null);
