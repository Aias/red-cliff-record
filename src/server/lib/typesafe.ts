import { TypeSafeClient } from '@typesafe-ai/sdk';

export const TYPESAFE_MODEL = 'jev-1.13.0';

let client: TypeSafeClient | null = null;

export function getTypeSafeClient(): TypeSafeClient {
  client ??= new TypeSafeClient({ defaultModel: TYPESAFE_MODEL });
  return client;
}
