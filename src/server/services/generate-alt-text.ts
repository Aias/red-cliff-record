import { media } from '@hozo';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { db } from '@/server/db/connections/postgres';
import { writeDebugOutput } from '@/server/integrations/common/debug-output';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { embedRecordsByIds } from '@/server/services/embed-records';
import { runConcurrentPool } from '@/shared/lib/async-pool';

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
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'avif', 'heif'];

export interface GenerateAltTextOptions {
  /** Regenerate even if altText already exists */
  force?: boolean;
  /** Do not write to the database (generate + return only) */
  dryRun?: boolean;
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

type GenerateAltTextInternalOptions = GenerateAltTextOptions & {
  signal?: AbortSignal;
};

/**
 * Check if image URL is accessible
 */
async function checkImageAccessible(url: string, signal?: AbortSignal): Promise<boolean> {
  async function tryRequest(
    requestInit: RequestInit & { method: 'HEAD' | 'GET' }
  ): Promise<boolean> {
    try {
      const response = await fetch(url, { ...requestInit, signal });
      return response.ok;
    } catch {
      if (signal?.aborted) {
        throw new Error('Timed out after 90s');
      }
      return false;
    }
  }

  const headOk = await tryRequest({ method: 'HEAD' });
  if (headOk) return true;

  // Some CDNs/servers don't support HEAD (or treat it differently than GET).
  // Use a minimal GET with a Range header as a fallback to avoid downloading the full image.
  return tryRequest({
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
  });
}

/** Timeout for each alt text generation attempt (90 seconds) */
const ITEM_TIMEOUT_MS = 90_000;

/**
 * Call OpenAI vision API to generate alt text for an image.
 * Uses URL-based input since our images are on a public CDN.
 */
async function callVisionApi(
  imageUrl: string,
  prompt: string,
  signal?: AbortSignal
): Promise<VisionApiResult> {
  const openAiClientResult = getOpenAIClient();
  if (!openAiClientResult.ok) {
    return { ok: false, error: openAiClientResult.error };
  }

  try {
    const response = await openAiClientResult.client.responses.create(
      {
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
      },
      { signal, timeout: ITEM_TIMEOUT_MS }
    );

    const altText = response.output_text?.trim();
    if (!altText) {
      return { ok: false, error: 'Vision API returned no result' };
    }

    return { ok: true, altText };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

/**
 * Generate alt text for a single media item
 */
async function generateAltTextForMedia(
  mediaId: number,
  options: GenerateAltTextInternalOptions = {}
): Promise<GenerateAltTextResult> {
  const { force = false, dryRun = false, signal } = options;

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
    if (!dryRun) {
      await db.update(media).set({ altTextGeneratedAt: new Date() }).where(eq(media.id, mediaId));
    }
    return { ...baseResult, success: false, error: `Unsupported format: ${mediaItem.format}` };
  }

  // Check image is accessible
  const isAccessible = await checkImageAccessible(mediaItem.url, signal);
  if (!isAccessible) {
    logger.warn(`Image not accessible: ${mediaItem.url}`);
    if (!dryRun) {
      await db.update(media).set({ altTextGeneratedAt: new Date() }).where(eq(media.id, mediaId));
    }
    return { ...baseResult, success: false, error: 'Image URL not accessible' };
  }

  // Build prompt with context
  const prompt = ALT_TEXT_PROMPT.replace('{title}', record?.title || '(none)')
    .replace('{type}', record?.type || '(none)')
    .replace('{url}', record?.url || '(none)');

  // Call vision API with image URL directly
  const visionResult = await callVisionApi(mediaItem.url, prompt, signal);
  if (!visionResult.ok) {
    logger.error(
      `Vision API failed for media ${mediaId} (record ${record?.id ?? 'none'}, url: ${mediaItem.url}): ${visionResult.error}`
    );
    if (!dryRun) {
      await db.update(media).set({ altTextGeneratedAt: new Date() }).where(eq(media.id, mediaId));
    }
    return { ...baseResult, success: false, error: visionResult.error };
  }
  const { altText } = visionResult;
  const now = new Date();

  if (!dryRun) {
    // Update media record with alt text and generation timestamp
    await db
      .update(media)
      .set({ altText, altTextGeneratedAt: now, recordUpdatedAt: now })
      .where(eq(media.id, mediaId));
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

  const results = await runConcurrentPool({
    items: mediaIds,
    concurrency: 10,
    timeoutMs: ITEM_TIMEOUT_MS,
    worker: async (mediaId, _index, signal) => {
      const internalOptions: GenerateAltTextInternalOptions = { ...options, signal };
      try {
        return await generateAltTextForMedia(mediaId, internalOptions);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { mediaId, success: false, error: message } satisfies GenerateAltTextResult;
      }
    },
    onProgress: (completed, total) => {
      if (completed % 10 === 0 || completed === total) {
        logger.info(`Progress: ${completed}/${total}`);
      }
    },
  });

  const resolvedResults: GenerateAltTextResult[] = mediaIds.map((mediaId, index) => {
    const result = results[index];
    if (!result) {
      return { mediaId, success: false, error: 'Internal error: missing pool result' };
    }
    if (result.ok) {
      return result.value;
    }
    return { mediaId, success: false, error: result.error.message };
  });

  const generated = resolvedResults.filter((r) => r.success && !r.skipped).length;
  const skipped = resolvedResults.filter((r) => r.skipped).length;
  const failed = resolvedResults.filter((r) => !r.success).length;

  logger.info(
    `Alt text generation complete: ${generated} generated, ${skipped} skipped, ${failed} failed`
  );

  // Regenerate embeddings for affected records (unless dry run)
  if (!options.dryRun) {
    const recordIdsToEmbed = resolvedResults
      .filter(
        (r): r is GenerateAltTextResult & { recordId: number } =>
          r.success && !r.skipped && r.recordId !== undefined
      )
      .map((r) => r.recordId);

    if (recordIdsToEmbed.length > 0) {
      logger.info(`Regenerating embeddings for ${recordIdsToEmbed.length} affected record(s)`);
      const embedResults = await embedRecordsByIds(recordIdsToEmbed);
      const embedSuccess = embedResults.filter((r) => r.success).length;
      const embedFailed = embedResults.filter((r) => !r.success).length;
      logger.info(`Embedding regeneration: ${embedSuccess} succeeded, ${embedFailed} failed`);
    }
  }

  return resolvedResults;
}

export interface AltTextSyncOptions {
  /** Maximum number of images to process per run (default: 100) */
  limit?: number;
  /** If true, do not write; output results to `.temp/` */
  debug?: boolean;
}

export interface AltTextSyncResult {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  debugOutputPath?: string;
}

/**
 * Find images without alt text and generate for them.
 * Orders by recordCreatedAt desc to process newest items first.
 * Used by the sync integration.
 */
async function generateMissingAltText(
  options: AltTextSyncOptions = {}
): Promise<AltTextSyncResult> {
  const { limit = 100, debug = false } = options;

  logger.start(`Generating alt text for up to ${limit} images without descriptions`);

  // Calculate cooldown threshold
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - 7);

  // Find images without alt text that either:
  // - Have never been attempted (altTextGeneratedAt is null), OR
  // - Were attempted before the cooldown period (eligible for retry)
  const imagesWithoutAltText = await db.query.media.findMany({
    where: {
      type: 'image',
      format: { in: SUPPORTED_FORMATS },
      altText: { isNull: true },
      OR: [{ altTextGeneratedAt: { isNull: true } }, { altTextGeneratedAt: { lt: cooldownDate } }],
    },
    columns: { id: true },
    orderBy: (media, { desc }) => [desc(media.recordCreatedAt)],
    limit,
  });

  if (imagesWithoutAltText.length === 0) {
    logger.skip('No images without alt text');
    return { total: 0, generated: 0, skipped: 0, failed: 0 };
  }

  logger.info(`Found ${imagesWithoutAltText.length} images to process`);

  const mediaIds = imagesWithoutAltText.map((m) => m.id);
  const results = await generateAltText(mediaIds, { dryRun: debug });

  const summary = {
    total: results.length,
    generated: results.filter((r) => r.success && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.success).length,
  };

  let debugOutputPath: string | undefined;
  if (debug) {
    debugOutputPath = await writeDebugOutput('alt-text', {
      generatedAt: new Date().toISOString(),
      limit,
      results,
      summary,
    });
  }

  logger.complete(`Generated alt text for ${summary.generated} images`);

  return { ...summary, debugOutputPath };
}

/**
 * Run alt text generation as a sync integration.
 * Should be called before embeddings generation.
 */
export async function runAltTextIntegration(
  options: AltTextSyncOptions = {}
): Promise<AltTextSyncResult> {
  return generateMissingAltText(options);
}
