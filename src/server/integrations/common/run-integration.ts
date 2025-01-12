import { eq } from 'drizzle-orm';
import { db } from '~/server/db/connections';
import {
	integrationRuns,
	IntegrationStatus,
	RunType,
	type IntegrationType,
} from '~/server/db/schema/operations';

type IntegrationFunction = (_integrationRunId: number) => Promise<number>;

export async function runIntegration(
	integrationType: IntegrationType,
	fn: IntegrationFunction,
	runType: RunType = RunType.enum.sync
): Promise<void> {
	console.log(`Starting ${integrationType} integration run for ${runType}...`);

	const [run] = await db
		.insert(integrationRuns)
		.values({
			integrationType,
			runType,
			runStartTime: new Date(),
		})
		.returning();

	if (!run) {
		throw new Error('Could not create integration run.');
	}

	console.log(`Created integration run with ID ${run.id}`);

	try {
		console.log('Executing integration function...');
		const entriesCreated = await fn(run.id);
		console.log(`Successfully created ${entriesCreated} entries`);

		console.log('Updating integration run status...');
		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.enum.success,
				runEndTime: new Date(),
				entriesCreated,
			})
			.where(eq(integrationRuns.id, run.id));
		console.log('Integration run completed successfully');
	} catch (err) {
		console.error('Integration run failed:', err instanceof Error ? err.message : String(err));
		await db
			.update(integrationRuns)
			.set({
				status: IntegrationStatus.enum.fail,
				runEndTime: new Date(),
				message: err instanceof Error ? err.message : String(err),
			})
			.where(eq(integrationRuns.id, run.id));
		throw err;
	}
}
