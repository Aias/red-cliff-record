import { TEXT_EMBEDDING_DIMENSIONS } from '@hozo';
import { getOpenAIClient } from './openai';

const EMBEDDING_MODEL = 'text-embedding-3-large';

/**
 * The embedding model rejects inputs over 8,192 tokens. English text averages
 * ~4 characters per token; this budget leaves headroom for denser content
 * (code, URLs) while keeping the semantically rich head of the text.
 */
const MAX_INPUT_CHARS = 24_000;

/** Inputs per API request; requests are also capped at 300k tokens total. */
const MAX_BATCH_SIZE = 64;

const truncate = (text: string) =>
  text.length > MAX_INPUT_CHARS ? text.slice(0, MAX_INPUT_CHARS) : text;

/**
 * Create embedding vectors for a batch of texts in input order.
 * Texts are truncated to the model's input limit and sent in chunked requests;
 * the shared client retries rate-limit and server errors with backoff.
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += MAX_BATCH_SIZE) {
    const batch = texts.slice(start, start + MAX_BATCH_SIZE).map(truncate);
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
  }

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
