import OpenAI from 'openai';

/** Model for text generation and vision tasks (alt text, commit summaries). */
export const OPENAI_MODEL = 'gpt-5.6-luna';

let client: OpenAI | null = null;

/**
 * Shared OpenAI client. Constructed lazily so importing modules don't require
 * OPENAI_API_KEY at load time; the SDK reads the key from the environment and
 * throws a descriptive error at first use if it's missing.
 */
export function getOpenAIClient(): OpenAI {
  client ??= new OpenAI({ maxRetries: 4 });
  return client;
}
