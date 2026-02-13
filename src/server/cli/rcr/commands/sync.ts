/**
 * Sync commands for the CLI
 *
 * Calls sync functions directly for all integrations.
 */

import { z } from 'zod';
import { checkDatabaseConnection } from '@/server/db/connections/postgres';
import { syncLightroomImages } from '@/server/integrations/adobe/sync';
import { syncClaudeHistory } from '@/server/integrations/agents/sync-claude';
import { syncCodexHistory } from '@/server/integrations/agents/sync-codex';
import { syncCursorHistory } from '@/server/integrations/agents/sync-cursor';
import { syncAirtableData } from '@/server/integrations/airtable/sync';
import { syncAllBrowserData } from '@/server/integrations/browser-history/sync-all';
import { syncFeedbin } from '@/server/integrations/feedbin/sync';
import { syncGitHubData } from '@/server/integrations/github/sync';
import { syncRaindropData } from '@/server/integrations/raindrop/sync';
import { syncReadwiseDocuments } from '@/server/integrations/readwise/sync';
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
  'agents',
]);
type IntegrationName = z.infer<typeof IntegrationNameSchema>;
const INTEGRATION_LIST = IntegrationNameSchema.options;

/**
 * Run an integration sync
 * Usage: rcr sync [integration] [--debug]
 *
 * With no arguments, runs all daily syncs (browsing, raindrop, readwise,
 * github, airtable, twitter) followed by enrichments.
 *
 * With an integration name, runs that single sync followed by enrichments.
 * Available: github, readwise, raindrop, airtable, adobe, feedbin,
 *   browsing, twitter, agents
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

  // Run the single sync, then enrichments
  const startTime = performance.now();
  const syncResult = await runSingleSync(integration, { debug });
  await runEnrichments(debug);

  return success({
    ...syncResult,
    duration: Math.round(performance.now() - startTime),
  } as Parameters<typeof success>[0]);
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
export { run as agents };

interface SyncOptions {
  debug: boolean;
}

/** Run all enrichments in order: avatars → alt-text → embeddings */
async function runEnrichments(debug: boolean) {
  await runSaveAvatarsIntegration();
  await runAltTextIntegration({ debug });
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
      await syncReadwiseDocuments(debug);
      return {
        integration,
        success: true,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'raindrop': {
      await syncRaindropData(debug);
      return {
        integration,
        success: true,
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
      await syncLightroomImages(debug);
      return {
        integration,
        success: true,
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
    case 'agents': {
      const sessionLimit = 5;
      await syncClaudeHistory(debug, { sessionLimit });
      await syncCodexHistory(debug, { sessionLimit });
      await syncCursorHistory(debug, { sessionLimit });
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
    'github',
    'airtable',
    'twitter',
  ];

  const results: Array<{ step: string; success: boolean; error?: string }> = [];
  const startTime = performance.now();

  // Run external syncs
  for (const integration of dailyIntegrations) {
    try {
      await runSingleSync(integration, options);
      results.push({ step: integration, success: true });
    } catch (e) {
      results.push({
        step: integration,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Run enrichments once at the end
  try {
    await runEnrichments(options.debug);
    results.push({ step: 'enrich', success: true });
  } catch (e) {
    results.push({
      step: 'enrich',
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
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
