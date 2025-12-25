#!/usr/bin/env bun
/**
 * CLI entry point for Airtable sync
 *
 * This file handles CLI-specific concerns like console output,
 * process exit codes, and formatting for terminal execution.
 */

import { syncAirtableData } from '../integrations/airtable/sync';
import { createIntegrationLogger } from '../integrations/common/logging';
import { parseDebugFlag } from '../integrations/common/logging';

const logger = createIntegrationLogger('airtable', 'cli');

async function main(): Promise<void> {
	try {
		const debug = parseDebugFlag(logger);
		logger.start('=== STARTING AIRTABLE SYNC ===');
		await syncAirtableData(debug);
		logger.complete('=== AIRTABLE SYNC COMPLETED ===');
		logger.info('-'.repeat(50));
		process.exit(0);
	} catch (error) {
		logger.error('Error in Airtable sync', error);
		logger.error('=== AIRTABLE SYNC FAILED ===');
		logger.info('-'.repeat(50));
		process.exit(1);
	}
}

// Run the sync
void main();
