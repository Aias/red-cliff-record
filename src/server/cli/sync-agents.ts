#!/usr/bin/env bun
/**
 * CLI entry point for Agent History sync
 *
 * Syncs conversation history from agent providers (Claude Code, Codex, etc.)
 * to the debug output directory for inspection and iteration.
 *
 * Usage:
 *   bun run src/server/cli/sync-agents.ts --debug
 */

import { syncClaudeHistory } from '../integrations/agents/sync-claude';
import { syncCodexHistory } from '../integrations/agents/sync-codex';
import { createIntegrationLogger, parseDebugFlag } from '../integrations/common/logging';

const logger = createIntegrationLogger('agents', 'cli');

const DEFAULT_SESSION_LIMIT = 5;

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);

		if (!debug) {
			logger.warn('Running without --debug flag. No output will be written.');
			logger.info('Use --debug to write parsed data to .temp/agents-*-debug-*.json');
		}

		logger.start('=== STARTING AGENT HISTORY SYNC ===');

		// Sync Claude Code history
		await syncClaudeHistory(debug, {
			sessionLimit: DEFAULT_SESSION_LIMIT,
		});

		// Sync Codex CLI history
		await syncCodexHistory(debug, {
			sessionLimit: DEFAULT_SESSION_LIMIT,
		});

		logger.complete('=== AGENT HISTORY SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Agent History sync', error);
		logger.error('=== AGENT HISTORY SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

main();
