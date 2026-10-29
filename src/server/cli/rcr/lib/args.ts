import { Option } from 'effect';
import { Argument, Flag } from 'effect/cli';
import type { ZodType } from 'zod';
import { DateSchema } from '@/shared/types/api';
import { createError } from './errors';

const isPositive = (value: number) => value > 0;
const notPositive = (value: number) => `Expected a positive integer, got ${value}`;

export const idArgument = (name = 'id') =>
  Argument.Int(name).pipe(Argument.filter(isPositive, notPositive));

export const idsArgument = idArgument().pipe(Argument.variadic({ min: 1 }));

export const positiveIntFlag = (name: string) =>
  Flag.Int(name).pipe(Flag.filter(isPositive, notPositive));

export const limitFlag = (fallback: number) =>
  positiveIntFlag('limit').pipe(
    Flag.withDescription('Maximum number of results'),
    Flag.withDefault(fallback)
  );

export const offsetFlag = Flag.Int('offset').pipe(
  Flag.filter(
    (offset) => offset >= 0,
    (offset) => `Expected a non-negative offset, got ${offset}`
  ),
  Flag.withDescription('Number of results to skip'),
  Flag.withDefault(0)
);

/** A boolean filter that is unset unless given as --name or --no-name. */
export const filterFlag = (name: string, description: string) =>
  Flag.Boolean(name).pipe(Flag.withDescription(description), Flag.optional);

export const dateArgument = Argument.String('date').pipe(
  Argument.withDescription('Day as YYYY-MM-DD'),
  Argument.filter(
    (date) => DateSchema.safeParse(date).success,
    (date) => `Expected a date formatted YYYY-MM-DD, got ${date}`
  )
);

export const dataFlag = Flag.String('data').pipe(
  Flag.withDescription('JSON payload; read from stdin when omitted'),
  Flag.optional
);

export async function parseData<T>(schema: ZodType<T>, data: Option.Option<string>): Promise<T> {
  const json = Option.isSome(data) ? data.value : await Bun.stdin.text();
  if (!json.trim()) throw createError('VALIDATION_ERROR', 'No JSON input provided');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw createError('VALIDATION_ERROR', 'Invalid JSON input');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw createError('VALIDATION_ERROR', result.error.message);
  return result.data;
}
