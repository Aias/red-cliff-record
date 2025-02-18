import OpenAI from 'openai';
import { TEXT_EMBEDDING_DIMENSIONS } from '@/server/db/schema/operations';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Base interface for types that can be embedded.
 * All embedding classes should implement this interface to ensure consistent text generation.
 */
export interface EmbeddingType {
	/**
	 * Generates a text representation of the object that will be used to create the embedding.
	 * The text should include all relevant information about the object in a structured format.
	 *
	 * @returns A string containing the object's information, formatted with sections and key-value pairs
	 */
	getEmbeddingText(): string;
}

/**
 * Creates an embedding vector for the given text using OpenAI's text-embedding-3-large model.
 * The vector has 768 dimensions and can be used for semantic search and similarity comparisons.
 *
 * @param text - The text to create an embedding for
 * @returns A 768-dimensional vector representing the text's semantic meaning
 * @throws Error if the OpenAI API call fails or returns no embedding
 */
export async function createEmbedding(text: string): Promise<number[]> {
	const response = await openai.embeddings.create({
		input: text,
		model: 'text-embedding-3-large',
		dimensions: TEXT_EMBEDDING_DIMENSIONS,
	});

	if (!response.data?.[0]?.embedding) {
		throw new Error('OpenAI API returned no embedding');
	}

	console.log('Embedding created successfully');
	return response.data[0].embedding;
}
