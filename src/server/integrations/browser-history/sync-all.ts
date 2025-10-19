import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import { arcConfig } from './browsers/arc';
import { diaConfig } from './browsers/dia';
import { syncBrowserHistory as syncSingleBrowser } from './sync';
import { BrowserNotInstalledError } from './types';

const logger = createIntegrationLogger('browser-history', 'sync-all');

/**
 * Synchronizes all browser history (Arc and Dia) with the database
 * This function orchestrates multiple browser syncs under a single integration run
 */
async function syncAllBrowserData(
	integrationRunId: number,
	collectDebugData?: { arc: unknown[]; dia: unknown[] }
): Promise<number> {
	logger.start('Starting all browser history synchronization');
	let totalEntriesCreated = 0;

	// Run Arc browser sync
	try {
		logger.info('Starting Arc Browser Sync');
		const arcEntries = await syncSingleBrowser(arcConfig, integrationRunId, collectDebugData?.arc);
		totalEntriesCreated += arcEntries;
		logger.complete('Arc Browser Sync', arcEntries);
	} catch (error) {
		if (error instanceof BrowserNotInstalledError) {
			logger.warn(error.message + ' Skipping Arc sync.');
		} else {
			logger.error('Arc browser sync failed', error);
		}
		// Continue with Dia sync even if Arc fails
	}

	// Add a small delay between syncs to ensure clean separation
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Run Dia browser sync
	try {
		logger.info('Starting Dia Browser Sync');
		const diaEntries = await syncSingleBrowser(diaConfig, integrationRunId, collectDebugData?.dia);
		totalEntriesCreated += diaEntries;
		logger.complete('Dia Browser Sync', diaEntries);
	} catch (error) {
		if (error instanceof BrowserNotInstalledError) {
			logger.warn(error.message + ' Skipping Dia sync.');
		} else {
			logger.error('Dia browser sync failed', error);
		}
	}

	logger.complete('All browser history synchronization completed', totalEntriesCreated);
	return totalEntriesCreated;
}

/**
 * Orchestrates all browser history synchronization
 *
 * @param debug - If true, writes raw data to a timestamped JSON file
 */
async function syncAllBrowserHistory(debug = false): Promise<void> {
	const debugContext = createDebugContext('browser-history', debug, {
		arc: [] as unknown[],
		dia: [] as unknown[],
	});
	try {
		logger.start('Starting browser history synchronization');

		await runIntegration('browser_history', (runId) =>
			syncAllBrowserData(runId, debugContext.data)
		);

		logger.complete('Browser history synchronization completed');
	} catch (error) {
		logger.error('Error syncing browser history', error);
		throw error;
	} finally {
		await debugContext.flush().catch((flushError) => {
			logger.error('Failed to write debug output for browser history', flushError);
		});
	}
}

export { syncAllBrowserHistory as syncAllBrowserData };
