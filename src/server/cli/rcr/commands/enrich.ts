import { z } from 'zod';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runEloRefit } from '@/server/services/refit-elo';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { runUpdateSourcesIntegration } from '@/server/services/update-sources';
import { assertNever } from '@/shared/lib/type-utils';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { withInterruptSignal } from '../lib/interrupt';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const EnrichmentNameSchema = z.enum(['avatars', 'alt-text', 'embeddings', 'elo', 'sources']);
type EnrichmentName = z.infer<typeof EnrichmentNameSchema>;
const ENRICHMENT_LIST = EnrichmentNameSchema.options;

const DEFAULT_ENRICHMENTS: EnrichmentName[] = ['avatars', 'alt-text', 'embeddings', 'elo'];

const EnrichOptionsSchema = BaseOptionsSchema.extend({
  limit: z.coerce.number().positive().int().optional(),
}).strict();

export const run: CommandHandler = (args, options) =>
  withInterruptSignal(async (signal) => {
    const parsedOptions = parseOptions(EnrichOptionsSchema, options);
    const { debug, limit } = parsedOptions;

    const rawEnrichment = args[0]?.toLowerCase();

    if (!rawEnrichment) {
      return runAllEnrichments({ debug, limit, signal });
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

    const result = await runSingleEnrichment(enrichment, { debug, limit, signal });
    return success(result);
  });

interface EnrichOptions {
  debug: boolean;
  limit?: number;
  signal: AbortSignal;
}

async function runSingleEnrichment(enrichment: EnrichmentName, options: EnrichOptions) {
  const { debug, limit, signal } = options;
  const startTime = performance.now();

  switch (enrichment) {
    case 'avatars': {
      await runSaveAvatarsIntegration(signal);
      return {
        enrichment,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'alt-text': {
      const result = await runAltTextIntegration({ debug, limit, signal });
      return {
        enrichment,
        success: true,
        ...result,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'embeddings': {
      await runEmbedRecordsIntegration(signal);
      return {
        enrichment,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'elo': {
      const result = await runEloRefit();
      return {
        enrichment,
        success: true,
        ...result,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'sources': {
      const result = await runUpdateSourcesIntegration(signal);
      return {
        enrichment,
        success: true,
        ...result,
        duration: Math.round(performance.now() - startTime),
      };
    }
    default:
      assertNever(enrichment);
  }
}

async function runAllEnrichments(options: EnrichOptions) {
  const results: Array<{ enrichment: string; success: boolean; error?: string }> = [];
  const startTime = performance.now();

  for (const enrichment of DEFAULT_ENRICHMENTS) {
    options.signal.throwIfAborted();
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
        total: DEFAULT_ENRICHMENTS.length,
        succeeded: successCount,
        failed: DEFAULT_ENRICHMENTS.length - successCount,
      },
    },
    { duration: Math.round(performance.now() - startTime) }
  );
}
