#!/usr/bin/env bun
/**
 * CLI entry point for Raindrop sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { syncRaindropData } from '../integrations/raindrop/sync';
import { parseDebugFlag } from '../integrations/common/logging';

const logger = createIntegrationLogger('raindrop', 'cli');

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);
		logger.start('=== STARTING RAINDROP SYNC ===');
		await syncRaindropData(debug);
		logger.complete('=== RAINDROP SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Raindrop sync', error);
		logger.error('=== RAINDROP SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
