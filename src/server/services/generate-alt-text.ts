import { media, records } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '@/server/integrations/common/logging';

const logger = createIntegrationLogger('services', 'generate-alt-text');

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Alt text generation prompt based on the established guidelines.
 */
const ALT_TEXT_PROMPT = `Write alt text for this image. Be straightforward, literal, and concise. Avoid flowery or interpretive language.

For text in images:
- Book/article highlights: "Page from [source] with highlighted text reading: [exact content]"
- UI screenshots: Describe layout and key features, don't transcribe all text
- Text as primary subject: Reproduce if short and relevant

Examples of good alt text:
- "Dark blue iron fence with pointed finials in front of a pyracantha bush with orange berries."
- "A single street lamp illuminates a stone embankment along the Tiber at dusk. Silhouetted trees against a pale sky, water reflecting the light below."
- "Diagram showing a timeline with two curved arrows illustrating the prophetic perfect tense."
- "Page from a book with yellow highlighted passage reading: 'take the hardest tasks imaginable and try to create convincing scenarios of how they might be done at all.'"
- "Screenshot of a journaling app showing a daily view for December 26, 2025. Left sidebar displays habit trackers. Main area shows two journal entries with embedded photos."

Context:
- Title: {title}
- Type: {type}
- URL: {url}

Respond with only the alt text, no preamble or commentary.`;

/**
 * Supported image formats for vision API
 */
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp'];

export interface GenerateAltTextOptions {
	/** Regenerate even if altText already exists */
	force?: boolean;
}

export interface GenerateAltTextResult {
	mediaId: number;
	recordId?: number;
	recordTitle?: string;
	success: boolean;
	altText?: string;
	skipped?: boolean;
	error?: string;
}

/**
 * Check if image URL is accessible
 */
async function checkImageAccessible(url: string): Promise<boolean> {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Call OpenAI vision API to generate alt text for an image.
 * Uses URL-based input since our images are on a public CDN.
 */
async function callVisionApi(imageUrl: string, prompt: string): Promise<string | null> {
	try {
		const response = await openai.responses.create({
			model: 'gpt-5.2',
			input: [
				{
					type: 'message',
					role: 'user',
					content: [
						{ type: 'input_text', text: prompt },
						{ type: 'input_image', image_url: imageUrl, detail: 'auto' },
					],
				},
			],
		});

		return response.output_text?.trim() || null;
	} catch (error) {
		logger.error('OpenAI vision API error:', error);
		return null;
	}
}

/**
 * Generate alt text for a single media item
 */
async function generateAltTextForMedia(
	mediaId: number,
	options: GenerateAltTextOptions = {}
): Promise<GenerateAltTextResult> {
	const { force = false } = options;

	// Fetch media with optional parent record context
	const mediaItem = await db.query.media.findFirst({
		where: { id: mediaId },
		with: {
			record: {
				columns: {
					id: true,
					title: true,
					type: true,
					url: true,
				},
			},
		},
	});

	if (!mediaItem) {
		return { mediaId, success: false, error: 'Media not found' };
	}

	const record = mediaItem.record;
	const baseResult = {
		mediaId,
		recordId: record?.id,
		recordTitle: record?.title ?? undefined,
	};

	// Skip if already has alt text and not forcing
	if (mediaItem.altText && !force) {
		return { ...baseResult, success: true, skipped: true };
	}

	// Only process images
	if (mediaItem.type !== 'image') {
		// For videos, we'd need thumbnail extraction - skip for now
		return { ...baseResult, success: false, error: `Unsupported media type: ${mediaItem.type}` };
	}

	// Check format is supported
	if (!SUPPORTED_FORMATS.includes(mediaItem.format.toLowerCase())) {
		logger.warn(`Unsupported image format: ${mediaItem.format} for media ${mediaId}`);
		return { ...baseResult, success: false, error: `Unsupported format: ${mediaItem.format}` };
	}

	// Check image is accessible
	const isAccessible = await checkImageAccessible(mediaItem.url);
	if (!isAccessible) {
		logger.warn(`Image not accessible: ${mediaItem.url}`);
		return { ...baseResult, success: false, error: 'Image URL not accessible' };
	}

	// Build prompt with context
	const prompt = ALT_TEXT_PROMPT.replace('{title}', record?.title || '(none)')
		.replace('{type}', record?.type || '(none)')
		.replace('{url}', record?.url || '(none)');

	// Call vision API with image URL directly
	const altText = await callVisionApi(mediaItem.url, prompt);
	if (!altText) {
		return { ...baseResult, success: false, error: 'Vision API returned no result' };
	}

	// Update media record
	await db
		.update(media)
		.set({ altText, recordUpdatedAt: new Date() })
		.where(eq(media.id, mediaId));

	// Invalidate parent record's embedding since alt text affects it
	if (record?.id) {
		await db
			.update(records)
			.set({ textEmbedding: null })
			.where(eq(records.id, record.id));
		logger.info(`Invalidated embedding for record ${record.id}`);
	}

	logger.info(`Generated alt text for media ${mediaId}: "${altText.slice(0, 50)}..."`);

	return { ...baseResult, success: true, altText };
}

/**
 * Generate alt text for multiple media items.
 *
 * This is the main entry point, used by:
 * - TRPC endpoint
 * - CLI command
 * - Sync scripts (called at end of sync with new media IDs)
 *
 * @param mediaIds - Array of media IDs to process
 * @param options - Generation options
 * @returns Array of results for each media ID
 */
export async function generateAltText(
	mediaIds: number[],
	options: GenerateAltTextOptions = {}
): Promise<GenerateAltTextResult[]> {
	if (mediaIds.length === 0) {
		return [];
	}

	logger.info(`Generating alt text for ${mediaIds.length} media items`);

	// Process in parallel with concurrency limit
	const BATCH_SIZE = 5;
	const results: GenerateAltTextResult[] = [];

	for (let i = 0; i < mediaIds.length; i += BATCH_SIZE) {
		const batch = mediaIds.slice(i, i + BATCH_SIZE);
		const batchResults = await Promise.all(
			batch.map((id) => generateAltTextForMedia(id, options))
		);
		results.push(...batchResults);

		const successful = batchResults.filter((r) => r.success && !r.skipped).length;
		const skipped = batchResults.filter((r) => r.skipped).length;
		const failed = batchResults.filter((r) => !r.success).length;

		logger.info(
			`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(mediaIds.length / BATCH_SIZE)}: ${successful} generated, ${skipped} skipped, ${failed} failed`
		);
	}

	const summary = {
		total: results.length,
		generated: results.filter((r) => r.success && !r.skipped).length,
		skipped: results.filter((r) => r.skipped).length,
		failed: results.filter((r) => !r.success).length,
	};

	logger.info(
		`Alt text generation complete: ${summary.generated} generated, ${summary.skipped} skipped, ${summary.failed} failed`
	);

	return results;
}
