#!/usr/bin/env bun
/**
 * CLI entry point to restore stripped Twitter links on records
 *
 * Usage:
 *   bun run src/server/cli/restore-twitter-links.ts                    # Apply changes
 *   bun run src/server/cli/restore-twitter-links.ts --dry-run          # Preview changes only
 *   bun run src/server/cli/restore-twitter-links.ts --dry-run --limit 100  # Preview first 100
 */

import { createIntegrationLogger } from '../integrations/common/logging';
import { restoreTweetRecordLinks } from '../integrations/twitter/restore';

const logger = createIntegrationLogger('twitter', 'restore-cli');

function parseDryRunFlag(): boolean {
	return process.argv.includes('--dry-run') || process.argv.includes('-n');
}

function parseLimitFlag(): number | undefined {
	const limitIndex = process.argv.findIndex((arg) => arg === '--limit' || arg === '-l');
	if (limitIndex === -1) return undefined;

	const limitValue = process.argv[limitIndex + 1];
	if (!limitValue) return undefined;

	const parsed = parseInt(limitValue, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

async function main(): Promise<void> {
	const dryRun = parseDryRunFlag();
	const limit = parseLimitFlag();

	try {
		const modeLabel = dryRun ? ' (DRY RUN)' : '';
		const limitLabel = limit ? ` [limit: ${limit}]` : '';
		logger.start(`=== TWITTER LINK RESTORE${modeLabel}${limitLabel} ===`);

		await restoreTweetRecordLinks({ dryRun, limit });

		logger.complete(
			dryRun ? '=== DRY RUN COMPLETED ===' : '=== TWITTER LINK RESTORE COMPLETED ==='
		);
		process.exit(0);
	} catch (error) {
		logger.error('Error restoring Twitter links', error);
		process.exit(1);
	}
}

void main();
