import { withBufferedLogs } from '../common/buffered-logs';
import { createDebugContext } from '../common/debug-output';
import { createIntegrationLogger } from '../common/logging';
import { runIntegration } from '../common/run-integration';
import { createRecordsFromGithubRepositories, createRecordsFromGithubUsers } from './map';
import { syncGitHubCommits } from './sync-commits';
import { syncGitHubStars } from './sync-stars';
import { updatePartialUsers } from './sync-users';

const logger = createIntegrationLogger('github', 'sync');

/**
 * Runs independent sync steps concurrently, buffering each step's logs so
 * they emit as contiguous blocks, and surfacing the first failure only after
 * every step has settled.
 */
async function runConcurrentSteps(steps: Array<() => Promise<unknown>>): Promise<void> {
  const settled = await Promise.allSettled(steps.map((step) => withBufferedLogs(step)));
  for (const result of settled) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
}

/**
 * Orchestrates the GitHub data synchronization process
 *
 * This function coordinates the execution of multiple GitHub integration steps:
 * 1. Syncs starred repositories and commit history (independent, run concurrently)
 * 2. Updates user information for users created by either sync
 * 3. Creates records from GitHub users
 * 4. Creates records from GitHub repositories
 *
 * Each sync is wrapped in the runIntegration utility to track execution.
 *
 * @param debug - If true, fetches data and outputs to .temp/ without writing to database
 * @returns Promise that resolves when all GitHub data is synced
 * @throws Rethrows any errors from the integration steps
 */
async function syncGitHubData(debug = false): Promise<void> {
  const debugContext = createDebugContext<{ stars: unknown[]; commits: unknown[] }>(
    'github',
    debug,
    {
      stars: [],
      commits: [],
    }
  );
  try {
    if (debug) {
      // Debug mode: fetch data and output to .temp/ only, skip database writes
      logger.start('Starting GitHub data fetch (debug mode - no database writes)');
      await runConcurrentSteps([
        () => syncGitHubStars(-1, debugContext.data?.stars, true),
        () => syncGitHubCommits(-1, debugContext.data?.commits, true),
      ]);
      logger.complete('GitHub data fetch completed (debug mode)');
    } else {
      // Normal mode: full sync with database writes
      logger.start('Starting GitHub data synchronization');

      // Step 1: Sync starred repositories and commit history concurrently
      await runConcurrentSteps([
        () => runIntegration('github', (runId) => syncGitHubStars(runId, debugContext.data?.stars)),
        () =>
          runIntegration('github', (runId) => syncGitHubCommits(runId, debugContext.data?.commits)),
      ]);

      // Step 2: Update user information
      await updatePartialUsers();

      // Step 3-4: Create records from GitHub entities
      await createRecordsFromGithubUsers();
      await createRecordsFromGithubRepositories();

      logger.complete('GitHub data synchronization completed');
    }
  } catch (error) {
    logger.error('Error syncing GitHub data', error);
    throw error;
  } finally {
    await debugContext.flush().catch((flushError) => {
      logger.error('Failed to write debug output for GitHub', flushError);
    });
  }
}

export { syncGitHubData };
