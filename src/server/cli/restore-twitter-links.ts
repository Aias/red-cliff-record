#!/usr/bin/env bun
/**
 * CLI entry point to restore stripped Twitter links on records
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { restoreTweetRecordLinks } from '../integrations/twitter/restore';

const logger = createIntegrationLogger('twitter', 'restore-cli');

async function main(): Promise<void> {
	try {
		logger.start('=== STARTING TWITTER LINK RESTORE ===');
		await restoreTweetRecordLinks();
		logger.complete('=== TWITTER LINK RESTORE COMPLETED ===');
		process.exit(0);
	} catch (error) {
		logger.error('Error restoring Twitter links', error);
		logger.error('=== TWITTER LINK RESTORE FAILED ===');
		process.exit(1);
	}
}

main();
