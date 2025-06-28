import { syncArcBrowserData } from './sync-arc';
import { syncDiaBrowserData } from './sync-dia';

/**
 * Synchronizes all browser history (Arc and Dia) with the database
 */
export async function syncAllBrowserData(): Promise<void> {
	console.log('Starting all browser history synchronization');

	// Run both browser syncs in sequence
	// We run them in sequence rather than parallel to avoid overwhelming the system
	// and to make the output easier to read

	try {
		await syncArcBrowserData();
	} catch (error) {
		console.error('Arc browser sync failed:', error);
		// Continue with Dia sync even if Arc fails
	}

	try {
		await syncDiaBrowserData();
	} catch (error) {
		console.error('Dia browser sync failed:', error);
	}

	console.log('All browser history synchronization completed');
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING ALL BROWSER SYNC ===\n');
		await syncAllBrowserData();
		console.log('\n=== ALL BROWSER SYNC COMPLETED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in all browser sync main function:', error);
		console.log('\n=== ALL BROWSER SYNC FAILED ===\n');
		console.log('\n' + '-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync-all.ts')) {
	main();
}
