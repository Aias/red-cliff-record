import { integrationRuns, IntegrationStatus, RunType, type IntegrationType } from '@hozo';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/connections';
import { createIntegrationLogger } from './logging';

/**
 * Function signature for integration implementations
 * @param integrationRunId - The ID of the current integration run
 * @returns Promise resolving to the number of entries created during the run
 */
type IntegrationFunction = (integrationRunId: number) => Promise<number>;

/**
 * Executes an integration function within a tracked run context
 *
 * This function handles:
 * 1. Creating a run record in the database
 * 2. Executing the integration function
 * 3. Updating the run record with results or error information
 *
 * @param integrationType - The type of integration being run (e.g., 'github', 'raindrop')
 * @param fn - The integration function to execute
 * @param runType - The type of run (defaults to 'sync')
 * @throws Rethrows any errors from the integration function after logging them
 */
export async function runIntegration(
  integrationType: IntegrationType,
  fn: IntegrationFunction,
  runType: RunType = RunType.enum.sync
): Promise<void> {
  const integrationLabel = integrationType.replace(/_/g, '-');
  const logger = createIntegrationLogger(integrationLabel, runType);

  logger.start(`Starting ${integrationLabel} integration run`);

  // Create a new integration run record
  const [run] = await db
    .insert(integrationRuns)
    .values({
      integrationType,
      runType,
      runStartTime: new Date(),
    })
    .returning();

  if (!run) {
    throw new Error('Failed to create integration run record');
  }

  logger.info(`Created integration run with ID ${run.id}`);

  try {
    // Execute the integration function
    logger.info('Executing integration function...');
    const entriesCreated = await fn(run.id);
    logger.complete('Successfully created entries', entriesCreated);

    // Update the run record with success status
    logger.info('Updating integration run status...');
    await db
      .update(integrationRuns)
      .set({
        status: IntegrationStatus.enum.success,
        runEndTime: new Date(),
        entriesCreated,
      })
      .where(eq(integrationRuns.id, run.id));
    logger.complete('Integration run completed successfully');
  } catch (error) {
    // Handle and log any errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Integration run failed', errorMessage);

    // Update the run record with failure status
    await db
      .update(integrationRuns)
      .set({
        status: IntegrationStatus.enum.fail,
        runEndTime: new Date(),
        message: errorMessage,
      })
      .where(eq(integrationRuns.id, run.id));

    // Rethrow the error for upstream handling
    throw error;
  }
}
