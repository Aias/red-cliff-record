#!/usr/bin/env bun
/**
 * CLI entry point for Twitter sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { syncTwitterData } from '../integrations/twitter/sync';

const logger = createIntegrationLogger('twitter', 'cli');

async function main(): Promise<void> {
	try {
		logger.start('=== STARTING TWITTER SYNC ===');
		await syncTwitterData();
		logger.complete('=== TWITTER SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Twitter sync', error);
		logger.error('=== TWITTER SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
