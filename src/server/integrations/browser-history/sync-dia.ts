import { runIntegration } from '../common/run-integration';
import { diaConfig } from './browsers/dia';
import { syncBrowserHistory } from './sync';

/**
 * Synchronizes Dia browser history with the database
 */
export async function syncDiaBrowserData(): Promise<void> {
	await runIntegration('browser_history', (integrationRunId) =>
		syncBrowserHistory(diaConfig, integrationRunId)
	);
}
