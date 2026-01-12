/**
 * Sync commands for the CLI
 *
 * Calls sync functions directly for all integrations.
 */

import { z } from 'zod';
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
	'avatars',
	'alt-text',
	'embeddings',
	'daily',
]);
type IntegrationName = z.infer<typeof IntegrationNameSchema>;
const INTEGRATION_LIST = IntegrationNameSchema.options;

const AltTextSyncOptionsSchema = BaseOptionsSchema.extend({
	limit: z.coerce.number().positive().int().optional(),
}).strict();

/**
 * Run an integration sync
 * Usage: rcr sync <integration> [--debug]
 *
 * Available integrations:
 *   github, readwise, raindrop, airtable, adobe, feedbin,
 *   browsing, twitter, agents, daily (all daily syncs)
 *
 * Options:
 *   --limit=N   For alt-text/daily: max images to process (default: 100)
 */
export const run: CommandHandler = async (args, options) => {
	const rawIntegration = args[0]?.toLowerCase();

	if (!rawIntegration) {
		throw createError(
			'VALIDATION_ERROR',
			`Integration name required. Available: ${INTEGRATION_LIST.join(', ')}`
		);
	}

	const integrationResult = IntegrationNameSchema.safeParse(rawIntegration);
	if (!integrationResult.success) {
		throw createError(
			'VALIDATION_ERROR',
			`Unknown integration: ${rawIntegration}. Available: ${INTEGRATION_LIST.join(', ')}`
		);
	}
	const integration = integrationResult.data;

	if (integration !== 'alt-text' && integration !== 'daily' && options.limit !== undefined) {
		throw createError(
			'VALIDATION_ERROR',
			'--limit is only supported for `rcr sync alt-text` (or `rcr sync daily`).'
		);
	}

	let debug: boolean;
	let limit: number | undefined;

	if (integration === 'alt-text' || integration === 'daily') {
		const parsedOptions = parseOptions(AltTextSyncOptionsSchema, options);
		debug = parsedOptions.debug;
		limit = parsedOptions.limit;
	} else {
		const parsedOptions = parseOptions(BaseOptionsSchema.strict(), options);
		debug = parsedOptions.debug;
		limit = undefined;
	}

	// Handle 'daily' as a special case that runs multiple syncs
	if (integration === 'daily') {
		return runDailySync({ debug, limit });
	}

	const result = await runSingleSync(integration, { debug, limit });
	// Integration results have complex types that don't fit ResultValue exactly,
	// but they serialize to JSON correctly which is what the CLI needs
	return success(result as Parameters<typeof success>[0]);
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
export { run as avatars };
export { run as 'alt-text' };
export { run as embeddings };
export { run as daily };

interface SyncOptions {
	debug: boolean;
	limit?: number;
}

async function runSingleSync(integration: IntegrationName, options: SyncOptions) {
	const { debug, limit } = options;
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
		case 'avatars': {
			await runSaveAvatarsIntegration();
			return {
				integration,
				success: true,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'alt-text': {
			const result = await runAltTextIntegration({ debug, limit });
			return {
				integration,
				success: true,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'embeddings': {
			await runEmbedRecordsIntegration();
			return {
				integration,
				success: true,
				duration: Math.round(performance.now() - startTime),
			};
		}
		default:
			throw createError('VALIDATION_ERROR', `Unknown integration: ${integration}`);
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
		'alt-text', // Generate alt text before embeddings
		'embeddings',
	];

	const results: Array<{ integration: string; success: boolean; error?: string }> = [];
	const startTime = performance.now();

	for (const integration of dailyIntegrations) {
		try {
			await runSingleSync(integration, options);
			results.push({ integration, success: true });
		} catch (e) {
			results.push({
				integration,
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
				total: dailyIntegrations.length,
				succeeded: successCount,
				failed: dailyIntegrations.length - successCount,
			},
		},
		{ duration: Math.round(performance.now() - startTime) }
	);
}
