import { media, records } from '@aias/hozo';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from '@/server/integrations/common/logging';

const logger = createIntegrationLogger('services', 'generate-alt-text');

let openai: OpenAI | null = null;

type OpenAIClientResult =
	| {
			ok: true;
			client: OpenAI;
	  }
	| {
			ok: false;
			error: string;
	  };

function getOpenAIClient(): OpenAIClientResult {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return { ok: false, error: 'OPENAI_API_KEY is not set' };
	}

	if (openai) {
		return { ok: true, client: openai };
	}

	openai = new OpenAI({ apiKey });
	return { ok: true, client: openai };
}

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

type VisionApiResult =
	| {
			ok: true;
			altText: string;
	  }
	| {
			ok: false;
			error: string;
	  };

/**
 * Check if image URL is accessible
 */
async function checkImageAccessible(url: string): Promise<boolean> {
	async function tryRequest(
		requestInit: RequestInit & { method: 'HEAD' | 'GET' }
	): Promise<boolean> {
		try {
			const response = await fetch(url, requestInit);
			return response.ok;
		} catch {
			return false;
		}
	}

	const headOk = await tryRequest({ method: 'HEAD' });
	if (headOk) return true;

	// Some CDNs/servers don't support HEAD (or treat it differently than GET).
	// Use a minimal GET with a Range header as a fallback to avoid downloading the full image.
	return await tryRequest({
		method: 'GET',
		headers: { Range: 'bytes=0-0' },
	});
}

/**
 * Call OpenAI vision API to generate alt text for an image.
 * Uses URL-based input since our images are on a public CDN.
 */
async function callVisionApi(imageUrl: string, prompt: string): Promise<VisionApiResult> {
	const openAiClientResult = getOpenAIClient();
	if (!openAiClientResult.ok) {
		return { ok: false, error: openAiClientResult.error };
	}

	try {
		const response = await openAiClientResult.client.responses.create({
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

		const altText = response.output_text?.trim();
		if (!altText) {
			return { ok: false, error: 'Vision API returned no result' };
		}

		return { ok: true, altText };
	} catch (error) {
		logger.error('OpenAI vision API error:', error);
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: `OpenAI vision API error: ${message}` };
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

	// Only process images (skip other media types)
	if (mediaItem.type !== 'image') {
		return { ...baseResult, success: true, skipped: true };
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
	const visionResult = await callVisionApi(mediaItem.url, prompt);
	if (!visionResult.ok) {
		return { ...baseResult, success: false, error: visionResult.error };
	}
	const { altText } = visionResult;

	// Update media record
	await db.update(media).set({ altText, recordUpdatedAt: new Date() }).where(eq(media.id, mediaId));

	// Invalidate parent record's embedding since alt text affects it
	if (record?.id) {
		await db.update(records).set({ textEmbedding: null }).where(eq(records.id, record.id));
		logger.info(`Invalidated embedding for record ${record.id}`);
	}

	const recordTitle = record?.title ?? '(none)';
	const recordTitlePreview =
		recordTitle.length > 120 ? `${recordTitle.slice(0, 120)}…` : recordTitle;
	const altTextPreview = altText.length > 100 ? `${altText.slice(0, 100)}…` : altText;

	logger.info(
		`Generated alt text for media ${mediaId} (record ${record?.id ?? 'none'} "${recordTitlePreview}"): "${altTextPreview}"`
	);

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
		const batchResults = await Promise.all(batch.map((id) => generateAltTextForMedia(id, options)));
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

export interface AltTextSyncOptions {
	/** Maximum number of images to process per run (default: 100) */
	limit?: number;
}

/**
 * Find images without alt text and generate for them.
 * Orders by recordCreatedAt desc to process newest items first.
 * Used by the sync integration.
 */
async function generateMissingAltText(options: AltTextSyncOptions = {}): Promise<number> {
	const { limit = 100 } = options;

	logger.start(`Generating alt text for up to ${limit} images without descriptions`);

	// Find images without alt text, newest first
	const imagesWithoutAltText = await db.query.media.findMany({
		where: {
			type: 'image',
			altText: { isNull: true },
		},
		columns: { id: true },
		orderBy: (media, { desc }) => [desc(media.recordCreatedAt)],
		limit,
	});

	if (imagesWithoutAltText.length === 0) {
		logger.skip('No images without alt text');
		return 0;
	}

	logger.info(`Found ${imagesWithoutAltText.length} images to process`);

	const mediaIds = imagesWithoutAltText.map((m) => m.id);
	const results = await generateAltText(mediaIds);

	const generated = results.filter((r) => r.success && !r.skipped).length;
	logger.complete(`Generated alt text for ${generated} images`);

	return generated;
}

/**
 * Run alt text generation as a sync integration.
 * Should be called before embeddings generation.
 */
export async function runAltTextIntegration(options: AltTextSyncOptions = {}) {
	await generateMissingAltText(options);
}
