import { z } from 'zod';
import { checkDatabaseConnection } from '@/server/db/connections/postgres';
import { runIntegrationSync } from '@/server/integrations/runtime/runtime';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runAltTextIntegration } from '@/server/services/generate-alt-text';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { assertNever } from '@/shared/lib/type-utils';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createError } from '../lib/errors';
import { withInterruptSignal } from '../lib/interrupt';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const IntegrationNameSchema = z.enum([
  'github',
  'github-commits',
  'readwise',
  'raindrop',
  'adobe',
  'feedbin',
  'browsing',
  'twitter',
]);
type IntegrationName = z.infer<typeof IntegrationNameSchema>;
const INTEGRATION_LIST = IntegrationNameSchema.options;

const SyncCommandOptionsSchema = BaseOptionsSchema.extend({
  'allow-new-hostname': z.boolean().default(false),
});

export const run: CommandHandler = (args, options) =>
  withInterruptSignal(async (signal) => {
    const rawIntegration = args[0]?.toLowerCase();

    const parsedOptions = parseOptions(SyncCommandOptionsSchema.strict(), options);
    const { debug } = parsedOptions;
    const syncOptions = { debug, allowNewHostname: parsedOptions['allow-new-hostname'], signal };

    try {
      await checkDatabaseConnection();
    } catch (e) {
      throw createError('DATABASE_ERROR', e instanceof Error ? e.message : String(e));
    }

    if (!rawIntegration) {
      return runDailySync(syncOptions);
    }

    const integrationResult = IntegrationNameSchema.safeParse(rawIntegration);
    if (!integrationResult.success) {
      throw createError(
        'VALIDATION_ERROR',
        `Unknown integration: ${rawIntegration}. Available: ${INTEGRATION_LIST.join(', ')}`
      );
    }
    const integration = integrationResult.data;

    const startTime = performance.now();
    const syncResult = await runSingleSync(integration, syncOptions);
    if (!debug) await runEnrichments(signal);

    return success({
      ...syncResult,
      duration: Math.round(performance.now() - startTime),
    });
  });

export { run as github };
export { run as readwise };
export { run as raindrop };
export { run as adobe };
export { run as feedbin };
export { run as browsing };
export { run as twitter };

interface SyncOptions {
  debug: boolean;
  allowNewHostname: boolean;
  signal: AbortSignal;
}

async function runEnrichments(signal: AbortSignal) {
  signal.throwIfAborted();
  await runSaveAvatarsIntegration(signal);
  signal.throwIfAborted();
  await runAltTextIntegration({ signal });
  signal.throwIfAborted();
  await runEmbedRecordsIntegration(signal);
}

async function runSingleSync(integration: IntegrationName, options: SyncOptions) {
  const startTime = performance.now();

  switch (integration) {
    case 'github': {
      const commits = await runIntegrationSync('github-commits', options);
      const stars = await runIntegrationSync('github', options);
      return {
        integration,
        success: true,
        entriesCreated: commits.entriesCreated + stars.entriesCreated,
        failedItems: commits.failures.length + stars.failures.length,
        duration: Math.round(performance.now() - startTime),
      };
    }
    case 'github-commits':
    case 'readwise':
    case 'raindrop':
    case 'adobe':
    case 'feedbin':
    case 'browsing':
    case 'twitter': {
      const summary = await runIntegrationSync(integration, options);
      return {
        integration,
        success: true,
        entriesCreated: summary.entriesCreated,
        failedItems: summary.failures.length,
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
    'twitter',
    'github',
  ];

  const startTime = performance.now();

  const results: Array<{ step: string; success: boolean; error?: string }> = await Promise.all(
    dailyIntegrations.map(async (integration) => {
      try {
        await runSingleSync(integration, options);
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

  options.signal.throwIfAborted();
  if (!options.debug) {
    try {
      await runEnrichments(options.signal);
      results.push({ step: 'enrich', success: true });
    } catch (e) {
      results.push({
        step: 'enrich',
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  options.signal.throwIfAborted();

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
