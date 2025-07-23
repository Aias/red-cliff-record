#!/usr/bin/env bun
/**
 * CLI entry point for Readwise sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { syncReadwiseDocuments } from '../integrations/readwise/sync';

const logger = createIntegrationLogger('readwise', 'cli');

async function main(): Promise<void> {
	try {
		logger.start('=== STARTING READWISE SYNC ===');
		await syncReadwiseDocuments();
		logger.complete('=== READWISE SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Readwise sync', error);
		logger.error('=== READWISE SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
