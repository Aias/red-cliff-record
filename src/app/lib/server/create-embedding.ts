import OpenAI from 'openai';
import { TEXT_EMBEDDING_DIMENSIONS } from '@/shared/types';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Creates an embedding vector for the given text using OpenAI's text-embedding-3-large model.
 * The vector has 768 dimensions and can be used for semantic search and similarity comparisons.
 *
 * @param text - The text to create an embedding for
 * @returns A 768-dimensional vector representing the text's semantic meaning
 * @throws Error if the OpenAI API call fails or returns no embedding
 */
export async function createEmbedding(text: string): Promise<number[]> {
	const { data } = await openai.embeddings.create({
		input: text,
		model: 'text-embedding-3-large',
		dimensions: TEXT_EMBEDDING_DIMENSIONS,
	});

	if (!data[0]?.embedding) {
		throw new Error('OpenAI API returned no embedding');
	}

	return data[0].embedding;
}
