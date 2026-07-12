import { TEXT_EMBEDDING_DIMENSIONS } from '@hozo';
import { getOpenAIClient } from './openai';

const EMBEDDING_MODEL = 'text-embedding-3-large';

/**
 * The embedding model rejects inputs over 8,192 tokens and requests over
 * 300,000 tokens total. Token counts are estimated from character classes —
 * ASCII text runs ~4 characters per token, while dense scripts (CJK, emoji)
 * can reach ~2 tokens per character — so both caps hold for worst-case
 * content without a tokenizer dependency. The margins absorb the estimate's
 * imprecision.
 */
const MAX_INPUT_TOKENS = 7_500;
const MAX_REQUEST_TOKENS = 250_000;
const MAX_BATCH_SIZE = 64;

const estimateTokens = (text: string): number => {
  let ascii = 0;
  let other = 0;
  for (const char of text) {
    if ((char.codePointAt(0) ?? 0) < 128) {
      ascii += 1;
    } else {
      other += 1;
    }
  }
  return Math.ceil(ascii / 3) + other * 2;
};

const truncateToTokenBudget = (text: string): { text: string; tokens: number } => {
  let result = text;
  let tokens = estimateTokens(result);
  while (tokens > MAX_INPUT_TOKENS) {
    result = result
      .slice(0, Math.floor((result.length * MAX_INPUT_TOKENS) / tokens))
      .replace(/[\uD800-\uDBFF]$/, '');
    tokens = estimateTokens(result);
  }
  return { text: result, tokens };
};

/**
 * Create embedding vectors for a batch of texts in input order.
 * Texts are truncated to the model's input limit and packed into requests by
 * estimated token count; the shared client retries rate-limit and server
 * errors with backoff.
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  let batch: string[] = [];
  let batchTokens = 0;

  const flush = async (): Promise<void> => {
    if (batch.length === 0) {
      return;
    }
    const { data } = await getOpenAIClient().embeddings.create({
      input: batch,
      model: EMBEDDING_MODEL,
      dimensions: TEXT_EMBEDDING_DIMENSIONS,
    });
    if (data.length !== batch.length) {
      throw new Error(`OpenAI returned ${data.length} embeddings for ${batch.length} inputs`);
    }
    for (const item of data.toSorted((a, b) => a.index - b.index)) {
      embeddings.push(item.embedding);
    }
    batch = [];
    batchTokens = 0;
  };

  for (const input of texts) {
    const { text, tokens } = truncateToTokenBudget(input);
    if (batch.length >= MAX_BATCH_SIZE || batchTokens + tokens > MAX_REQUEST_TOKENS) {
      await flush();
    }
    batch.push(text);
    batchTokens += tokens;
  }
  await flush();

  return embeddings;
}

/** Create an embedding vector for a single text. */
export async function createEmbedding(text: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([text]);
  if (!embedding) {
    throw new Error('OpenAI API returned no embedding');
  }
  return embedding;
}
