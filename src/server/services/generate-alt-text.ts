import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { media } from '@hozo';
import { eq } from 'drizzle-orm';
import mime from 'mime-types';
import OpenAI from 'openai';
import { db } from '@/server/db/connections/postgres';
import { writeDebugOutput } from '@/server/integrations/common/debug-output';
import { createIntegrationLogger } from '@/server/integrations/common/logging';
import { embedRecordsByIds } from '@/server/services/embed-records';
import { runConcurrentPool } from '@/shared/lib/async-pool';

const logger = createIntegrationLogger('services', 'generate-alt-text');

const OPENAI_TIMEOUT_MS = 90_000;
const ALT_TEXT_WORKER_TIMEOUT_MS = 180_000;
const COMMAND_TIMEOUT_MS = 45_000;
const IMAGE_DIRECT_INPUT_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_DOWNSAMPLE_MAX_DIMENSION = 2048;
const IMAGE_DOWNSAMPLE_JPEG_QUALITY = 6;
const VIDEO_FRAME_MAX_DIMENSION = 1600;
const VIDEO_FRAME_JPEG_QUALITY = 6;
const VIDEO_FRAME_FRACTIONS = [0, 0.5, 0.9];
const ALT_TEXT_MEDIA_TYPES: Array<'image' | 'video'> = ['image', 'video'];
const OPENAI_DIRECT_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp'];

const ALT_TEXT_PROMPT_GUIDELINES = `Be straightforward, literal, and concise. Avoid flowery or interpretive language.

For text in visuals:
- Book/article highlights: "Page from [source] with highlighted text reading: [exact content]"
- UI screenshots: Describe layout and key features; do not transcribe all text
- Text as primary subject: Reproduce if short and relevant

Examples of good alt text:
- "Dark blue iron fence with pointed finials in front of a pyracantha bush with orange berries."
- "A single street lamp illuminates a stone embankment along the Tiber at dusk. Silhouetted trees against a pale sky, water reflecting the light below."
- "Diagram showing a timeline with two curved arrows illustrating the prophetic perfect tense."
- "Page from a book with yellow highlighted passage reading: 'take the hardest tasks imaginable and try to create convincing scenarios of how they might be done at all.'"
- "Screenshot of a journaling app showing a daily view for December 26, 2025. Left sidebar displays habit trackers. Main area shows two journal entries with embedded photos."
- "Short video clip of a dog jumping into a lake and swimming back to shore."

Respond with only the alt text, no preamble or commentary.`;

let openai: OpenAI | null = null;

interface VisionInputImage {
  detail: 'auto' | 'high' | 'low';
  image_url: string;
  type: 'input_image';
}

type OpenAIClientResult =
  | {
      ok: true;
      client: OpenAI;
    }
  | {
      ok: false;
      error: string;
    };

type VisionApiResult =
  | {
      ok: true;
      altText: string;
    }
  | {
      ok: false;
      error: string;
    };

type CommandResult =
  | {
      ok: true;
      stdout: string;
    }
  | {
      ok: false;
      error: string;
    };

type BinaryFetchResult =
  | {
      ok: true;
      bytes: Uint8Array;
      contentType: string;
    }
  | {
      ok: false;
      error: string;
    };

type PreparedImageResult =
  | {
      ok: true;
      bytes: number;
      downsampled: boolean;
      input: VisionInputImage;
    }
  | {
      ok: false;
      error: string;
    };

type DownsampleImageResult =
  | {
      ok: true;
      bytes: Uint8Array;
    }
  | {
      ok: false;
      error: string;
    };

type VideoFrameExtractionResult =
  | {
      ok: true;
      frames: VisionInputImage[];
    }
  | {
      ok: false;
      error: string;
    };

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

type GenerateAltTextInternalOptions = GenerateAltTextOptions & {
  signal?: AbortSignal;
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

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function timeoutErrorMessage(): string {
  return `Timed out after ${ALT_TEXT_WORKER_TIMEOUT_MS / 1000}s`;
}

function normalizeMimeType(value: string): string {
  const [mimeType] = value.split(';');
  if (!mimeType) {
    return 'application/octet-stream';
  }

  const normalized = mimeType.trim().toLowerCase();
  if (normalized.length === 0) {
    return 'application/octet-stream';
  }

  return normalized;
}

function isSvgMimeType(value: string): boolean {
  return normalizeMimeType(value) === 'image/svg+xml';
}

function isSvgFormat(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === 'svg' || normalized === 'svg+xml';
}

function getImageMimeType(
  fetchedContentType: string,
  storedContentType: string,
  format: string
): string {
  const candidates = [fetchedContentType, storedContentType];

  for (const candidate of candidates) {
    const normalized = normalizeMimeType(candidate);
    if (normalized.startsWith('image/')) {
      return normalized;
    }
  }

  const guessedFromFormat = mime.lookup(format);
  if (typeof guessedFromFormat === 'string' && guessedFromFormat.startsWith('image/')) {
    return guessedFromFormat;
  }

  return 'image/jpeg';
}

function toDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

function buildAltTextPrompt(
  context: { title: string; type: string; url: string },
  mediaType: 'image' | 'video',
  frameCount = 1
): string {
  const mediaInstruction =
    mediaType === 'video'
      ? `Write alt text for this video. You are receiving ${frameCount} still frame(s) sampled in chronological order from the same video. Describe visible action if relevant.`
      : 'Write alt text for this image.';

  return `${mediaInstruction}

${ALT_TEXT_PROMPT_GUIDELINES}

Context:
- Title: ${context.title}
- Type: ${context.type}
- URL: ${context.url}`;
}

async function runCommand(
  cmd: string[],
  options: { signal?: AbortSignal; timeoutMs: number }
): Promise<CommandResult> {
  const { signal, timeoutMs } = options;

  if (signal?.aborted) {
    return { ok: false, error: timeoutErrorMessage() };
  }

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(cmd, {
      stderr: 'pipe',
      stdin: 'ignore',
      stdout: 'pipe',
    });
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);

  const abortListener = () => {
    proc.kill();
  };

  signal?.addEventListener('abort', abortListener, { once: true });

  try {
    const stdoutBody = proc.stdout;
    const stderrBody = proc.stderr;

    if (
      stdoutBody === undefined ||
      stderrBody === undefined ||
      typeof stdoutBody === 'number' ||
      typeof stderrBody === 'number'
    ) {
      return { ok: false, error: `Command output streams are not piped: ${cmd.join(' ')}` };
    }

    const stdoutPromise = new Response(stdoutBody).text();
    const stderrPromise = new Response(stderrBody).text();
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      stdoutPromise,
      stderrPromise,
    ]);

    if (timedOut) {
      return { ok: false, error: `Command timed out: ${cmd[0]}` };
    }

    if (signal?.aborted) {
      return { ok: false, error: timeoutErrorMessage() };
    }

    if (exitCode !== 0) {
      const stderrText = stderr.trim();
      if (stderrText.length > 0) {
        return { ok: false, error: stderrText };
      }
      return { ok: false, error: `Command failed with exit code ${exitCode}: ${cmd.join(' ')}` };
    }

    return { ok: true, stdout: stdout.trim() };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortListener);
  }
}

function sanitizeExtension(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (/^[a-z0-9]+$/.test(normalized)) {
    return normalized;
  }

  return 'bin';
}

async function rasterizeSvgToPng(
  svgBytes: Uint8Array,
  signal?: AbortSignal
): Promise<DownsampleImageResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'rcr-alt-text-svg-'));
  const inputPath = join(tempDir, 'input.svg');
  const outputPath = join(tempDir, 'output.png');

  try {
    await writeFile(inputPath, svgBytes);

    const rasterizeResult = await runCommand(
      ['sips', '-s', 'format', 'png', inputPath, '--out', outputPath],
      { signal, timeoutMs: COMMAND_TIMEOUT_MS }
    );

    if (!rasterizeResult.ok) {
      return { ok: false, error: rasterizeResult.error };
    }

    const outputBytes = await readFile(outputPath);
    if (outputBytes.byteLength === 0) {
      return { ok: false, error: 'Rasterized SVG is empty' };
    }

    return { ok: true, bytes: new Uint8Array(outputBytes) };
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, error: timeoutErrorMessage() };
    }

    return { ok: false, error: toErrorMessage(error) };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function fetchBinary(url: string, signal?: AbortSignal): Promise<BinaryFetchResult> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return { ok: false, error: `Failed to fetch media: HTTP ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    return {
      ok: true,
      bytes: new Uint8Array(arrayBuffer),
      contentType,
    };
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, error: timeoutErrorMessage() };
    }

    return { ok: false, error: toErrorMessage(error) };
  }
}

async function downsampleImageToJpeg(
  imageBytes: Uint8Array,
  inputFormat: string,
  signal?: AbortSignal
): Promise<DownsampleImageResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'rcr-alt-text-image-'));
  const inputPath = join(tempDir, `input.${sanitizeExtension(inputFormat)}`);
  const outputPath = join(tempDir, 'output.jpg');

  try {
    await writeFile(inputPath, imageBytes);

    const downsampleResult = await runCommand(
      [
        'ffmpeg',
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-vf',
        `scale=${IMAGE_DOWNSAMPLE_MAX_DIMENSION}:${IMAGE_DOWNSAMPLE_MAX_DIMENSION}:force_original_aspect_ratio=decrease`,
        '-q:v',
        `${IMAGE_DOWNSAMPLE_JPEG_QUALITY}`,
        outputPath,
      ],
      { signal, timeoutMs: COMMAND_TIMEOUT_MS }
    );

    if (!downsampleResult.ok) {
      return { ok: false, error: downsampleResult.error };
    }

    const outputBytes = await readFile(outputPath);
    if (outputBytes.byteLength === 0) {
      return { ok: false, error: 'Downsampled image is empty' };
    }

    return { ok: true, bytes: new Uint8Array(outputBytes) };
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, error: timeoutErrorMessage() };
    }

    return { ok: false, error: toErrorMessage(error) };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function shouldUseDirectImageInput(imageFormat: string, byteLength: number): boolean {
  const format = imageFormat.trim().toLowerCase();
  return OPENAI_DIRECT_IMAGE_FORMATS.includes(format) && byteLength <= IMAGE_DIRECT_INPUT_MAX_BYTES;
}

async function prepareImageForVision(
  mediaItem: {
    contentTypeString: string;
    format: string;
    url: string;
  },
  signal?: AbortSignal
): Promise<PreparedImageResult> {
  const fetched = await fetchBinary(mediaItem.url, signal);
  if (!fetched.ok) {
    return { ok: false, error: fetched.error };
  }

  const originalMimeType = getImageMimeType(
    fetched.contentType,
    mediaItem.contentTypeString,
    mediaItem.format
  );

  const svgInput =
    isSvgFormat(mediaItem.format) ||
    isSvgMimeType(fetched.contentType) ||
    isSvgMimeType(mediaItem.contentTypeString);

  if (svgInput) {
    const rasterized = await rasterizeSvgToPng(fetched.bytes, signal);
    if (!rasterized.ok) {
      return { ok: false, error: `SVG rasterization failed: ${rasterized.error}` };
    }

    if (shouldUseDirectImageInput('png', rasterized.bytes.byteLength)) {
      return {
        ok: true,
        bytes: rasterized.bytes.byteLength,
        downsampled: true,
        input: {
          detail: 'auto',
          image_url: toDataUrl(rasterized.bytes, 'image/png'),
          type: 'input_image',
        },
      };
    }

    const downsampled = await downsampleImageToJpeg(rasterized.bytes, 'png', signal);
    if (!downsampled.ok) {
      return { ok: false, error: `Image downsample failed: ${downsampled.error}` };
    }

    return {
      ok: true,
      bytes: downsampled.bytes.byteLength,
      downsampled: true,
      input: {
        detail: 'auto',
        image_url: toDataUrl(downsampled.bytes, 'image/jpeg'),
        type: 'input_image',
      },
    };
  }

  if (shouldUseDirectImageInput(mediaItem.format, fetched.bytes.byteLength)) {
    return {
      ok: true,
      bytes: fetched.bytes.byteLength,
      downsampled: false,
      input: {
        detail: 'auto',
        image_url: toDataUrl(fetched.bytes, originalMimeType),
        type: 'input_image',
      },
    };
  }

  const downsampled = await downsampleImageToJpeg(fetched.bytes, mediaItem.format, signal);
  if (!downsampled.ok) {
    const formatIsDirect = OPENAI_DIRECT_IMAGE_FORMATS.includes(mediaItem.format.toLowerCase());
    const exceedsByteLimit = fetched.bytes.byteLength > IMAGE_DIRECT_INPUT_MAX_BYTES;

    // If we only tried to downsample for a non-standard format and size is already small,
    // fall back to original bytes. This still improves compatibility for formats OpenAI can parse.
    if (!formatIsDirect && !exceedsByteLimit) {
      logger.warn(
        `Image transcode failed for ${mediaItem.url}; falling back to original bytes: ${downsampled.error}`
      );
      return {
        ok: true,
        bytes: fetched.bytes.byteLength,
        downsampled: false,
        input: {
          detail: 'auto',
          image_url: toDataUrl(fetched.bytes, originalMimeType),
          type: 'input_image',
        },
      };
    }

    return { ok: false, error: `Image downsample failed: ${downsampled.error}` };
  }

  return {
    ok: true,
    bytes: downsampled.bytes.byteLength,
    downsampled: true,
    input: {
      detail: 'auto',
      image_url: toDataUrl(downsampled.bytes, 'image/jpeg'),
      type: 'input_image',
    },
  };
}

async function probeVideoDurationSeconds(
  videoUrl: string,
  signal?: AbortSignal
): Promise<number | undefined> {
  const durationResult = await runCommand(
    [
      'ffprobe',
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      videoUrl,
    ],
    { signal, timeoutMs: 15_000 }
  );

  if (!durationResult.ok) {
    return undefined;
  }

  const duration = Number.parseFloat(durationResult.stdout);
  if (!Number.isFinite(duration) || duration <= 0) {
    return undefined;
  }

  return duration;
}

function buildVideoFrameTimestamps(durationSeconds?: number): number[] {
  if (durationSeconds === undefined) {
    return [0];
  }

  const uniqueKeys = new Set<string>();
  const timestamps: number[] = [];

  for (const fraction of VIDEO_FRAME_FRACTIONS) {
    const rawTimestamp = durationSeconds * fraction;
    const boundedTimestamp = Math.max(0, Math.min(durationSeconds, rawTimestamp));
    const roundedTimestamp = Number(boundedTimestamp.toFixed(3));
    const key = roundedTimestamp.toFixed(3);

    if (uniqueKeys.has(key)) {
      continue;
    }

    uniqueKeys.add(key);
    timestamps.push(roundedTimestamp);
  }

  return timestamps.length > 0 ? timestamps : [0];
}

async function extractVideoFramesForVision(
  videoUrl: string,
  signal?: AbortSignal
): Promise<VideoFrameExtractionResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'rcr-alt-text-video-'));

  try {
    const durationSeconds = await probeVideoDurationSeconds(videoUrl, signal);
    const timestamps = buildVideoFrameTimestamps(durationSeconds);
    const frames: VisionInputImage[] = [];
    const extractionErrors: string[] = [];

    for (let index = 0; index < timestamps.length; index += 1) {
      const timestamp = timestamps[index];
      if (timestamp === undefined) {
        continue;
      }

      const outputPath = join(tempDir, `frame-${index}.jpg`);

      const frameResult = await runCommand(
        [
          'ffmpeg',
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-ss',
          `${timestamp}`,
          '-i',
          videoUrl,
          '-frames:v',
          '1',
          '-vf',
          `scale=${VIDEO_FRAME_MAX_DIMENSION}:${VIDEO_FRAME_MAX_DIMENSION}:force_original_aspect_ratio=decrease`,
          '-q:v',
          `${VIDEO_FRAME_JPEG_QUALITY}`,
          outputPath,
        ],
        { signal, timeoutMs: COMMAND_TIMEOUT_MS }
      );

      if (!frameResult.ok) {
        extractionErrors.push(`t=${timestamp}s: ${frameResult.error}`);
        continue;
      }

      const frameBytes = await readFile(outputPath);
      if (frameBytes.byteLength === 0) {
        extractionErrors.push(`t=${timestamp}s: extracted frame is empty`);
        continue;
      }

      frames.push({
        detail: 'auto',
        image_url: toDataUrl(new Uint8Array(frameBytes), 'image/jpeg'),
        type: 'input_image',
      });
    }

    if (frames.length === 0) {
      const details =
        extractionErrors.length > 0 ? extractionErrors.join(' | ') : 'no frame output';
      return { ok: false, error: `Unable to extract video frames (${details})` };
    }

    return { ok: true, frames };
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, error: timeoutErrorMessage() };
    }

    return { ok: false, error: toErrorMessage(error) };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function callVisionApi(
  prompt: string,
  images: VisionInputImage[],
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
            content: [{ type: 'input_text', text: prompt }, ...images],
          },
        ],
      },
      { signal, timeout: OPENAI_TIMEOUT_MS }
    );

    const altText = response.output_text?.trim();
    if (!altText) {
      return { ok: false, error: 'Vision API returned no result' };
    }

    return { ok: true, altText };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function markAltTextAttempted(mediaId: number, dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  await db.update(media).set({ altTextGeneratedAt: new Date() }).where(eq(media.id, mediaId));
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

  // Only process images/videos (skip other media types)
  if (mediaItem.type !== 'image' && mediaItem.type !== 'video') {
    return { ...baseResult, success: true, skipped: true };
  }

  const promptContext = {
    title: record?.title ?? '(none)',
    type: record?.type ?? '(none)',
    url: record?.url ?? '(none)',
  };

  let visionInputs: VisionInputImage[];
  let prompt: string;

  if (mediaItem.type === 'image') {
    const preparedImage = await prepareImageForVision(mediaItem, signal);
    if (!preparedImage.ok) {
      logger.error(
        `Image preprocessing failed for media ${mediaId} (record ${record?.id ?? 'none'}, url: ${mediaItem.url}): ${preparedImage.error}`
      );
      await markAltTextAttempted(mediaId, dryRun);
      return { ...baseResult, success: false, error: preparedImage.error };
    }

    if (preparedImage.downsampled) {
      logger.info(
        `Downsampled media ${mediaId} before vision request (${preparedImage.bytes} bytes final)`
      );
    }

    visionInputs = [preparedImage.input];
    prompt = buildAltTextPrompt(promptContext, 'image');
  } else {
    const extractedFrames = await extractVideoFramesForVision(mediaItem.url, signal);
    if (!extractedFrames.ok) {
      logger.error(
        `Video preprocessing failed for media ${mediaId} (record ${record?.id ?? 'none'}, url: ${mediaItem.url}): ${extractedFrames.error}`
      );
      await markAltTextAttempted(mediaId, dryRun);
      return { ...baseResult, success: false, error: extractedFrames.error };
    }

    visionInputs = extractedFrames.frames;
    prompt = buildAltTextPrompt(promptContext, 'video', visionInputs.length);
  }

  const visionResult = await callVisionApi(prompt, visionInputs, signal);
  if (!visionResult.ok) {
    logger.error(
      `Vision API failed for media ${mediaId} (record ${record?.id ?? 'none'}, url: ${mediaItem.url}): ${visionResult.error}`
    );
    await markAltTextAttempted(mediaId, dryRun);
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
    timeoutMs: ALT_TEXT_WORKER_TIMEOUT_MS,
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
  /** Maximum number of media items to process per run (default: 100) */
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
 * Find media without alt text and generate for them.
 * Orders by recordCreatedAt desc to process newest items first.
 * Used by the sync integration.
 */
async function generateMissingAltText(
  options: AltTextSyncOptions = {}
): Promise<AltTextSyncResult> {
  const { limit = 100, debug = false } = options;

  logger.start(`Generating alt text for up to ${limit} media items without descriptions`);

  // Calculate cooldown threshold
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - 7);

  // Find image/video media without alt text that either:
  // - Have never been attempted (altTextGeneratedAt is null), OR
  // - Were attempted before the cooldown period (eligible for retry)
  const mediaWithoutAltText = await db.query.media.findMany({
    where: {
      type: { in: ALT_TEXT_MEDIA_TYPES },
      altText: { isNull: true },
      OR: [{ altTextGeneratedAt: { isNull: true } }, { altTextGeneratedAt: { lt: cooldownDate } }],
    },
    columns: { id: true },
    orderBy: (media, { desc }) => [desc(media.recordCreatedAt)],
    limit,
  });

  if (mediaWithoutAltText.length === 0) {
    logger.skip('No media without alt text');
    return { total: 0, generated: 0, skipped: 0, failed: 0 };
  }

  logger.info(`Found ${mediaWithoutAltText.length} media items to process`);

  const mediaIds = mediaWithoutAltText.map((m) => m.id);
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

  logger.complete(`Generated alt text for ${summary.generated} media items`);

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
