#!/usr/bin/env bun
/**
 * CLI entry point for GitHub sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { parseDebugFlag } from '../integrations/common/logging';
import { syncGitHubData } from '../integrations/github/sync';

const logger = createIntegrationLogger('github', 'cli');

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);
		logger.start('=== STARTING GITHUB SYNC ===');
		await syncGitHubData(debug);
		logger.complete('=== GITHUB SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in GitHub sync', error);
		logger.error('=== GITHUB SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
main();
