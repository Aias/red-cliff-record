import { TEXT_EMBEDDING_DIMENSIONS } from '@hozo/schema/operations';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an embedding vector for the given text using OpenAI's text-embedding-3-large model.
 * The vector has 768 dimensions and can be used for semantic search and similarity comparisons.
 * Includes automatic retry with exponential backoff for rate limit errors.
 *
 * @param text - The text to create an embedding for
 * @param maxRetries - Maximum number of retry attempts (default: 5)
 * @returns A 768-dimensional vector representing the text's semantic meaning
 * @throws Error if the OpenAI API call fails after all retries or returns no embedding
 */
export async function createEmbedding(text: string, maxRetries = 5): Promise<number[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await openai.embeddings.create({
        input: text,
        model: 'text-embedding-3-large',
        dimensions: TEXT_EMBEDDING_DIMENSIONS,
      });

      if (!data[0]?.embedding) {
        throw new Error('OpenAI API returned no embedding');
      }

      return data[0].embedding;
    } catch (error: unknown) {
      lastError = error;

      // Check if it's a rate limit error
      if (error instanceof Error && 'status' in error && error.status === 429) {
        if (attempt < maxRetries) {
          // Extract wait time from error message if available
          let waitTime = Math.pow(2, attempt) * 1000; // Default exponential backoff: 1s, 2s, 4s, 8s, 16s

          // Try to parse the wait time from the error message
          const errorMessage = error.message || '';
          const waitMatch = errorMessage.match(/Please try again in (\d+)ms/);
          if (waitMatch && waitMatch[1]) {
            // Add a small buffer to the suggested wait time
            waitTime = parseInt(waitMatch[1], 10) + 100;
          }

          console.log(
            `Rate limit hit, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`
          );
          await sleep(waitTime);
          continue;
        }
      }

      // For non-rate-limit errors or if we've exhausted retries, throw immediately
      if (attempt === maxRetries) {
        break;
      }

      // For other errors, also retry with backoff
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(
        `Error creating embedding, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})...`,
        error
      );
      await sleep(waitTime);
    }
  }

  throw new Error(
    `Failed to create embedding after ${maxRetries} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}
