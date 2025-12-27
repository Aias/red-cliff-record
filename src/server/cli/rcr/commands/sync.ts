/**
 * Sync commands for the CLI
 *
 * Uses tRPC caller for integrations that have tRPC endpoints,
 * falls back to direct function calls for others.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { syncClaudeHistory } from '@/server/integrations/agents/sync-claude';
import { syncCodexHistory } from '@/server/integrations/agents/sync-codex';
import { syncCursorHistory } from '@/server/integrations/agents/sync-cursor';
import { syncAllBrowserData } from '@/server/integrations/browser-history/sync-all';
import { syncTwitterData } from '@/server/integrations/twitter/sync';
import { runEmbedRecordsIntegration } from '@/server/services/embed-records';
import { runSaveAvatarsIntegration } from '@/server/services/save-avatars';
import { BaseOptionsSchema, parseOptions } from '../lib/args';
import { createCLICaller } from '../lib/caller';
import { createError } from '../lib/errors';
import { success } from '../lib/output';
import type { CommandHandler } from '../lib/types';

const caller = createCLICaller();

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
	'embeddings',
	'daily',
]);
type IntegrationName = z.infer<typeof IntegrationNameSchema>;
const INTEGRATION_LIST = IntegrationNameSchema.options;

/**
 * Run an integration sync
 * Usage: rcr sync <integration> [--debug]
 *
 * Available integrations:
 *   github, readwise, raindrop, airtable, adobe, feedbin,
 *   browsing, twitter, agents, daily (all daily syncs)
 */
export const run: CommandHandler = async (args, options) => {
	const parsedOptions = parseOptions(BaseOptionsSchema.strict(), options);
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
	const debug = parsedOptions.debug;

	// Handle 'daily' as a special case that runs multiple syncs
	if (integration === 'daily') {
		return runDailySync(debug);
	}

	try {
		const result = await runSingleSync(integration, debug);
		// Integration results have complex types that don't fit ResultValue exactly,
		// but they serialize to JSON correctly which is what the CLI needs
		return success(result as Parameters<typeof success>[0]);
	} catch (e) {
		if (e instanceof TRPCError) {
			throw createError('INTERNAL_ERROR', e.message);
		}
		throw e;
	}
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
export { run as embeddings };
export { run as daily };

async function runSingleSync(integration: IntegrationName, debug: boolean) {
	const startTime = performance.now();

	switch (integration) {
		// tRPC-based syncs
		case 'github': {
			const result = await caller.integrations.runGithub();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'readwise': {
			const result = await caller.integrations.runReadwise();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'raindrop': {
			const result = await caller.integrations.runRaindrop();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'airtable': {
			const result = await caller.integrations.runAirtable();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'adobe': {
			const result = await caller.integrations.runAdobe();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}
		case 'feedbin': {
			const result = await caller.integrations.runFeedbin();
			return {
				integration,
				...result,
				duration: Math.round(performance.now() - startTime),
			};
		}

		// Direct function calls for syncs not in tRPC
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

async function runDailySync(debug: boolean) {
	const dailyIntegrations: IntegrationName[] = [
		'browsing',
		'feedbin',
		'raindrop',
		'readwise',
		'github',
		'airtable',
	];

	const results: Array<{ integration: string; success: boolean; error?: string }> = [];
	const startTime = performance.now();

	for (const integration of dailyIntegrations) {
		try {
			await runSingleSync(integration, debug);
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
