import { TypeSafeClient } from '@typesafe-ai/sdk';

export const TYPESAFE_MODEL = 'jev-1.13.0';

let client: TypeSafeClient | null = null;

export function getTypeSafeClient(): TypeSafeClient {
  client ??= new TypeSafeClient({ defaultModel: TYPESAFE_MODEL });
  return client;
}

export function stateFields(
  fields: Record<string, string | null | undefined>
): Record<string, string> {
  const state: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value?.trim();
    if (trimmed) state[key] = trimmed;
  }
  return state;
}
