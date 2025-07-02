import { runIntegration } from '../common/run-integration';
import { arcConfig } from './browsers/arc';
import { syncBrowserHistory } from './sync';

/**
 * Synchronizes Arc browser history with the database
 */
export async function syncArcBrowserData(): Promise<void> {
	await runIntegration('browser_history', (integrationRunId) =>
		syncBrowserHistory(arcConfig, integrationRunId)
	);
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING ARC BROWSER SYNC ===\n');
		await syncArcBrowserData();
		console.log('\n=== ARC BROWSER SYNC COMPLETED ===\n');
		console.log('-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Arc browser sync main function:', error);
		console.log('\n=== ARC BROWSER SYNC FAILED ===\n');
		console.log('-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync-arc.ts')) {
	main();
}
