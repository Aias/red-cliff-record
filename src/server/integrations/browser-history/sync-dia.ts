import { diaConfig } from './browsers/dia';
import { createBrowserSyncFunction } from './sync';

/**
 * Synchronizes Dia browser history with the database
 */
export const syncDiaBrowserData = createBrowserSyncFunction(diaConfig);

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING DIA BROWSER SYNC ===\n');
		await syncDiaBrowserData();
		console.log('\n=== DIA BROWSER SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in Dia browser sync main function:', error);
		console.log('\n=== DIA BROWSER SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync-dia.ts')) {
	main();
}
