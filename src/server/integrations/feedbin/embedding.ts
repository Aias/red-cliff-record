import type { FeedbinEntry } from './types';

/**
 * OpenAI text-embedding-3-large model has a max token limit of 8192
 * We'll aim for ~6000 tokens to be safe, which is roughly 24000 characters
 */
const MAX_EMBEDDING_LENGTH = 24000;

/**
 * Create embedding text for a feed entry
 * Combines title, author, content, and summary for semantic search
 */
export function createFeedEntryEmbeddingText(entry: FeedbinEntry): string {
	const parts: string[] = [];

	// Add title if present
	if (entry.title) {
		parts.push(`Title: ${entry.title}`);
	}

	// Add author if present
	if (entry.author) {
		parts.push(`Author: ${entry.author}`);
	}

	// Add summary if present
	if (entry.summary) {
		parts.push(`Summary: ${entry.summary}`);
	}

	// Add content if present
	if (entry.content) {
		// Calculate remaining space after other parts
		const currentLength = parts.join('\n').length + entry.url.length + 10; // +10 for "URL: " and newlines
		const remainingSpace = MAX_EMBEDDING_LENGTH - currentLength;

		if (remainingSpace > 100) {
			// Only add content if we have meaningful space
			const contentToAdd = entry.content.slice(0, remainingSpace - 10); // -10 for "Content: " and potential "..."
			parts.push(
				`Content: ${contentToAdd}${entry.content.length > remainingSpace - 10 ? '...' : ''}`
			);
		}
	}

	// Add URL for context
	parts.push(`URL: ${entry.url}`);

	// Join with newlines for better embedding separation
	const result = parts.join('\n');

	// Final safety check
	if (result.length > MAX_EMBEDDING_LENGTH) {
		return result.slice(0, MAX_EMBEDDING_LENGTH - 3) + '...';
	}

	return result;
}

/**
 * Strip HTML tags from content for cleaner embeddings
 * Basic implementation - can be enhanced with a proper HTML parser if needed
 */
export function stripHtml(html: string): string {
	// Remove script and style elements
	let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
	text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

	// Remove HTML tags
	text = text.replace(/<[^>]+>/g, ' ');

	// Decode HTML entities
	text = text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');

	// Clean up whitespace
	text = text.replace(/\s+/g, ' ').trim();

	return text;
}

/**
 * Create a cleaner embedding text by stripping HTML
 */
export function createCleanFeedEntryEmbeddingText(entry: FeedbinEntry): string {
	const cleanEntry = {
		...entry,
		content: entry.content ? stripHtml(entry.content) : null,
		summary: entry.summary ? stripHtml(entry.summary) : null,
	};

	return createFeedEntryEmbeddingText(cleanEntry);
}
