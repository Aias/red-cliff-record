/**
 * Enrich commands for the CLI
 *
 * Runs enrichment operations on existing records:
 * - avatars: Upload external avatar URLs to R2
 * - alt-text: Generate alt text for images using OpenAI vision
 * - embeddings: Generate text embeddings for records
 */

import { z } from 'zod';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { assertNever } from '@/shared/lib/type-utils';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const EnrichmentNameSchema = z.enum(['avatars', 'alt-text', 'embeddings']);
type EnrichmentName = z.infer<typeof EnrichmentNameSchema>;
const ENRICHMENT_LIST = EnrichmentNameSchema.options;

const EnrichOptionsSchema = BaseOptionsSchema.extend({
  limit: z.coerce.number().positive().int().optional(),
}).strict();

/**
 * Run enrichment operations on existing records
 * Usage: rcr enrich [enrichment] [--debug] [--limit=N]
 *
 * Available enrichments:
 *   avatars     Upload external avatar URLs to R2
 *   alt-text    Generate alt text for images using OpenAI vision
 *   embeddings  Generate text embeddings for records
 *
 * If no enrichment is specified, runs all three in order.
 *
 * Options:
 *   --limit=N   For alt-text: max images to process (default: 100)
 */
export const run: CommandHandler = async (args, options) => {
  const parsedOptions = parseOptions(EnrichOptionsSchema, options);
  const { debug, limit } = parsedOptions;

  const rawEnrichment = args[0]?.toLowerCase();

  // If no enrichment specified, run all
  if (!rawEnrichment) {
    return runAllEnrichments({ debug, limit });
  }

  const enrichmentResult = EnrichmentNameSchema.safeParse(rawEnrichment);
  if (!enrichmentResult.success) {
    throw createError(
      'VALIDATION_ERROR',
      `Unknown enrichment: ${rawEnrichment}. Available: ${ENRICHMENT_LIST.join(', ')}`
    );
  }
  const enrichment = enrichmentResult.data;

  if (enrichment !== 'alt-text' && limit !== undefined) {
    throw createError('VALIDATION_ERROR', '--limit is only supported for `rcr enrich alt-text`.');
  }

  const result = await runSingleEnrichment(enrichment, { debug, limit });
  return success(result as Parameters<typeof success>[0]);
};

interface EnrichOptions {
  debug: boolean;
  limit?: number;
}

async function runSingleEnrichment(enrichment: EnrichmentName, options: EnrichOptions) {
  const { debug, limit } = options;
  const startTime = performance.now();

  switch (enrichment) {
    case 'avatars': {
      await runSaveAvatarsIntegration();
      return {
        enrichment,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'alt-text': {
      const result = await runAltTextIntegration({ debug, limit });
      return {
        enrichment,
        success: true,
        ...result,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'embeddings': {
      await runEmbedRecordsIntegration();
      return {
        enrichment,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    default:
      assertNever(enrichment);
  }
}

/**
 * Run all enrichments in order: avatars → alt-text → embeddings
 */
async function runAllEnrichments(options: EnrichOptions) {
  const enrichments: EnrichmentName[] = ['avatars', 'alt-text', 'embeddings'];
  const results: Array<{ enrichment: string; success: boolean; error?: string }> = [];
  const startTime = performance.now();

  for (const enrichment of enrichments) {
    try {
      await runSingleEnrichment(enrichment, options);
      results.push({ enrichment, success: true });
    } catch (e) {
      results.push({
        enrichment,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;

  return success(
    {
      results,
      summary: {
        total: enrichments.length,
        succeeded: successCount,
        failed: enrichments.length - successCount,
      },
    },
    { duration: Math.round(performance.now() - startTime) }
  );
}
