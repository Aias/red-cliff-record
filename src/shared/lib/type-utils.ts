/**
 * Creates an array that must contain all values of a string union type.
 * TypeScript will error at compile time if any values are missing.
 *
 * @example
 * type Status = 'pending' | 'active' | 'done';
 * const statuses = exhaustive<Status>()(['pending', 'active', 'done']); // OK
 * const statuses = exhaustive<Status>()(['pending', 'active']); // Error: missing 'done'
 */
export const exhaustive =
  <T extends string>() =>
  <const A extends readonly T[]>(arr: A & ([T] extends [A[number]] ? unknown : never)) =>
    arr;
