import { z } from 'zod';

/**
 * Transforms empty strings to null when validating with Zod
 *
 * This helper creates a Zod transformer that converts empty strings to null
 * before validating with the provided schema. Useful for handling optional
 * string fields from APIs that might return empty strings instead of null.
 *
 * @param schema - The Zod schema to apply after the transformation
 * @returns A Zod schema that transforms empty strings to null before validation
 * @example
 * const nameSchema = emptyStringToNull(z.string())
 * // '' -> null, 'value' -> 'value'
 */
export const emptyStringToNull = <T extends z.ZodType>(schema: T) =>
	z.preprocess((val) => (val === '' ? null : val), schema.nullable());
