import { createPgConnection } from '@schema/connections';
import {
	integrationRuns,
	IntegrationType,
	IntegrationStatus,
	RunType
} from '@schema/main/integrations';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const db = createPgConnection();

type IntegrationFunction = (integrationRunId: number) => Promise<number>;

export async function runIntegration(
	integrationType: z.infer<typeof IntegrationType>,
	fn: IntegrationFunction,
	runType: z.infer<typeof RunType> = RunType.enum.sync
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
				status: IntegrationStatus.enum.success,
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
				status: IntegrationStatus.enum.fail,
				runEndTime: new Date(),
				message: err instanceof Error ? err.message : String(err)
			})
			.where(eq(integrationRuns.id, run[0].id));
		throw err;
	}
}
