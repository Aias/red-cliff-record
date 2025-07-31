#!/usr/bin/env bun
/**
 * CLI entry point for Browser History sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { syncAllBrowserData } from '../integrations/browser-history/sync-all';
import { createIntegrationLogger } from '../integrations/common/logging';

const logger = createIntegrationLogger('browser-history', 'cli');

async function main(): Promise<void> {
	try {
		logger.start('=== STARTING BROWSER HISTORY SYNC ===');
		await syncAllBrowserData();
		logger.complete('=== BROWSER HISTORY SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Browser History sync', error);
		logger.error('=== BROWSER HISTORY SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
