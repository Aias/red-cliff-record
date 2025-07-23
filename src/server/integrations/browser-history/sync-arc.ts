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
