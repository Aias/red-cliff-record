import { db } from '../src/db';
import { integrationRuns, IntegrationType, IntegrationStatus, RunType } from '../src/schema';
import { eq } from 'drizzle-orm';

type IntegrationFunction = (integrationRunId: number) => Promise<number>;

export async function runIntegration(
	integrationType: IntegrationType,
	fn: IntegrationFunction,
	runType: RunType = RunType.FULL
): Promise<void> {
	console.log(`Starting ${integrationType} integration run for ${runType}...`);

	const run = await db
		.insert(integrationRuns)
		.values({
			integrationType,
			runType,
			runStartTime: new Date()
		})
		.returning();

	if (run.length === 0) {
		throw new Error('Could not create integration run.');
	}

	console.log(`Created integration run with ID ${run[0].id}`);

	try {
		console.log('Executing integration function...');
		const entriesCreated = await fn(run[0].id);
		console.log(`Successfully created ${entriesCreated} entries`);

		console.log('Updating integration run status...');
		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.SUCCESS,
				runEndTime: new Date(),
				entriesCreated
			})
			.where(eq(integrationRuns.id, run[0].id));
		console.log('Integration run completed successfully');
	} catch (err) {
		console.error('Integration run failed:', err instanceof Error ? err.message : String(err));
		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.FAIL,
				runEndTime: new Date(),
				message: err instanceof Error ? err.message : String(err)
			})
			.where(eq(integrationRuns.id, run[0].id));
		throw err;
	}
}
