import { runIntegration } from '../common/run-integration';
import { arcConfig } from './browsers/arc';
import { diaConfig } from './browsers/dia';
import { syncBrowserHistory } from './sync';
import { BrowserNotInstalledError } from './types';

/**
 * Synchronizes all browser history (Arc and Dia) with the database
 * This function orchestrates multiple browser syncs under a single integration run
 */
async function syncAllBrowserData(integrationRunId: number): Promise<number> {
	console.log('Starting all browser history synchronization');
	let totalEntriesCreated = 0;

	// Run Arc browser sync
	try {
		console.log('\n--- Starting Arc Browser Sync ---');
		const arcEntries = await syncBrowserHistory(arcConfig, integrationRunId);
		totalEntriesCreated += arcEntries;
		console.log(`--- Arc Browser Sync Complete: ${arcEntries} entries ---\n`);
	} catch (error) {
		if (error instanceof BrowserNotInstalledError) {
			console.warn(error.message + ' Skipping Arc sync.');
		} else {
			console.error('Arc browser sync failed:', error);
		}
		// Continue with Dia sync even if Arc fails
	}

	// Add a small delay between syncs to ensure clean separation
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Run Dia browser sync
	try {
		console.log('\n--- Starting Dia Browser Sync ---');
		const diaEntries = await syncBrowserHistory(diaConfig, integrationRunId);
		totalEntriesCreated += diaEntries;
		console.log(`--- Dia Browser Sync Complete: ${diaEntries} entries ---\n`);
	} catch (error) {
		if (error instanceof BrowserNotInstalledError) {
			console.warn(error.message + ' Skipping Dia sync.');
		} else {
			console.error('Dia browser sync failed:', error);
		}
	}

	console.log(
		`All browser history synchronization completed. Total entries: ${totalEntriesCreated}`
	);
	return totalEntriesCreated;
}

/**
 * Main execution function when run as a standalone script
 */
const main = async (): Promise<void> => {
	try {
		console.log('\n=== STARTING ALL BROWSER SYNC ===');
		console.log(`Process ID: ${process.pid}`);
		console.log('-'.repeat(50) + '\n');

		// Use runIntegration to wrap the entire sync process
		await runIntegration('browser_history', syncAllBrowserData);

		console.log('\n=== ALL BROWSER SYNC COMPLETED ===');
		console.log('-'.repeat(50) + '\n');
		process.exit(0);
	} catch (error) {
		console.error('Error in all browser sync main function:', error);
		console.log('\n=== ALL BROWSER SYNC FAILED ===');
		console.log('-'.repeat(50) + '\n');
		process.exit(1);
	}
};

// Execute main function if this file is run directly
if (import.meta.url === import.meta.resolve('./sync-all.ts')) {
	main();
}

export { syncAllBrowserData };
