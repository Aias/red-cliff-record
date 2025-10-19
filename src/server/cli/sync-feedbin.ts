#!/usr/bin/env bun
/**
 * CLI entry point for Feedbin sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { parseDebugFlag } from '../integrations/common/logging';
import { syncFeedbin } from '../integrations/feedbin/sync';

const logger = createIntegrationLogger('feedbin', 'cli');

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);
		logger.start('=== STARTING FEEDBIN SYNC ===');
		await syncFeedbin(debug);
		logger.complete('=== FEEDBIN SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Feedbin sync', error);
		logger.error('=== FEEDBIN SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
