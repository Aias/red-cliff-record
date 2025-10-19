#!/usr/bin/env bun
/**
 * CLI entry point for Adobe sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { syncLightroomImages } from '../integrations/adobe/sync';
import { createIntegrationLogger } from '../integrations/common/logging';
import { parseDebugFlag } from '../integrations/common/logging';

const logger = createIntegrationLogger('adobe', 'cli');

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);
		logger.start('=== STARTING ADOBE SYNC ===');
		await syncLightroomImages(debug);
		logger.complete('=== ADOBE SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Adobe sync', error);
		logger.error('=== ADOBE SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
