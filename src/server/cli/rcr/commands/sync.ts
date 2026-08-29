/**
 * Sync commands for the CLI
 *
 * Calls sync functions directly for all integrations.
 */

import { z } from 'zod';
import { checkDatabaseConnection } from '@/server/db/connections/postgres';
import { syncAirtableData } from '@/server/integrations/airtable/sync';
import { syncAllBrowserData } from '@/server/integrations/browser-history/sync-all';
import { withBufferedLogs } from '@/server/integrations/common/buffered-logs';
import { syncFeedbin } from '@/server/integrations/feedbin/sync';
import { syncGitHubData } from '@/server/integrations/github/sync';
import { runIntegrationSync } from '@/server/integrations/runtime/runtime';
import { syncTwitterData } from '@/server/integrations/twitter/sync';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { assertNever } from '@/shared/lib/type-utils';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const IntegrationNameSchema = z.enum([
  'github',
  'readwise',
  'raindrop',
  'airtable',
  'adobe',
  'feedbin',
  'browsing',
  'twitter',
]);
type IntegrationName = z.infer<typeof IntegrationNameSchema>;
const INTEGRATION_LIST = IntegrationNameSchema.options;

/**
 * Run an integration sync
 * Usage: rcr sync [integration] [--debug]
 *
 * With no arguments, runs all daily syncs (browsing, raindrop, readwise,
 * airtable, twitter, github) followed by enrichments.
 *
 * With an integration name, runs that single sync followed by enrichments.
 * Available: github, readwise, raindrop, airtable, adobe, feedbin,
 *   browsing, twitter
 *
 * Use `rcr enrich` to run enrichments separately.
 */
export const run: CommandHandler = async (args, options) => {
  const rawIntegration = args[0]?.toLowerCase();

  const parsedOptions = parseOptions(BaseOptionsSchema.strict(), options);
  const { debug } = parsedOptions;

  // Fail fast if the database is unreachable
  try {
    await checkDatabaseConnection();
  } catch (e) {
    throw createError('DATABASE_ERROR', e instanceof Error ? e.message : String(e));
  }

  // No argument: run all daily syncs + enrichments
  if (!rawIntegration) {
    return runDailySync({ debug });
  }

  const integrationResult = IntegrationNameSchema.safeParse(rawIntegration);
  if (!integrationResult.success) {
    throw createError(
      'VALIDATION_ERROR',
      `Unknown integration: ${rawIntegration}. Available: ${INTEGRATION_LIST.join(', ')}`
    );
  }
  const integration = integrationResult.data;

  // Run the single sync, then enrichments. Debug syncs persist nothing, so
  // there is nothing to enrich.
  const startTime = performance.now();
  const syncResult = await runSingleSync(integration, { debug });
  if (!debug) await runEnrichments();

  return success({
    ...syncResult,
    duration: Math.round(performance.now() - startTime),
  });
};

// Also export as default command name for `rcr sync github` style
export { run as github };
export { run as readwise };
export { run as raindrop };
export { run as airtable };
export { run as adobe };
export { run as feedbin };
export { run as browsing };
export { run as twitter };

interface SyncOptions {
  debug: boolean;
}

/** Run all enrichments in order: avatars → alt-text → embeddings */
async function runEnrichments() {
  await runSaveAvatarsIntegration();
  await runAltTextIntegration();
  await runEmbedRecordsIntegration();
}

async function runSingleSync(integration: IntegrationName, options: SyncOptions) {
  const { debug } = options;
  const startTime = performance.now();

  switch (integration) {
    case 'github': {
      await syncGitHubData(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'readwise': {
      const summary = await runIntegrationSync('readwise', { debug });
      return {
        integration,
        success: true,
        entriesCreated: summary.entriesCreated,
        failedItems: summary.failures.length,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'raindrop': {
      const summary = await runIntegrationSync('raindrop', { debug });
      return {
        integration,
        success: true,
        entriesCreated: summary.entriesCreated,
        failedItems: summary.failures.length,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'airtable': {
      await syncAirtableData(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'adobe': {
      const summary = await runIntegrationSync('adobe', { debug });
      return {
        integration,
        success: true,
        entriesCreated: summary.entriesCreated,
        failedItems: summary.failures.length,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'feedbin': {
      await syncFeedbin(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'browsing': {
      await syncAllBrowserData(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'twitter': {
      await syncTwitterData(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    default:
      assertNever(integration);
  }
}

async function runDailySync(options: SyncOptions) {
  const dailyIntegrations: IntegrationName[] = [
    'browsing',
    'raindrop',
    'readwise',
    'airtable',
    'twitter',
    'github',
  ];

  const startTime = performance.now();

  // Run external syncs concurrently — they hit disjoint APIs. Each
  // integration's logs are buffered and emitted as one contiguous block when
  // it finishes, so concurrent output never interleaves.
  const results: Array<{ step: string; success: boolean; error?: string }> = await Promise.all(
    dailyIntegrations.map(async (integration) => {
      try {
        await withBufferedLogs(() => runSingleSync(integration, options));
        return { step: integration, success: true };
      } catch (e) {
        return {
          step: integration,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  // Run enrichments once at the end. Debug syncs persist nothing, so there is
  // nothing to enrich.
  if (!options.debug) {
    try {
      await runEnrichments();
      results.push({ step: 'enrich', success: true });
    } catch (e) {
      results.push({
        step: 'enrich',
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
        total: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
      },
    },
    { duration: Math.round(performance.now() - startTime) }
  );
}
