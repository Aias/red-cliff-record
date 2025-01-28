import { index, integer, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { databaseTimestampsNonUpdatable } from '../common';
import { operationsSchema } from './schema';

export { operationsSchema };

export const IntegrationStatus = z.enum(['success', 'fail', 'in_progress']);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const integrationStatusEnum = operationsSchema.enum(
	'integration_status',
	IntegrationStatus.options
);

export const IntegrationType = z.enum([
	'ai_chat',
	'airtable',
	'browser_history',
	'crawler',
	'embeddings',
	'github',
	'lightroom',
	'manual',
	'raindrop',
	'readwise',
	'twitter',
]);
export type IntegrationType = z.infer<typeof IntegrationType>;
export const integrationTypeEnum = operationsSchema.enum(
	'integration_type',
	IntegrationType.options
);
export type IntegrationService =
	| 'adobe'
	| 'airtable'
	| 'arc'
	| 'github'
	| 'raindrop'
	| 'readwise'
	| 'twitter';

export const RunType = z.enum(['seed', 'sync']);
export type RunType = z.infer<typeof RunType>;
export const runTypeEnum = operationsSchema.enum('run_type', RunType.options);

export const integrationRuns = operationsSchema.table(
	'integration_runs',
	{
		id: serial('id').primaryKey(),
		integrationType: integrationTypeEnum('integration_type').notNull(),
		runType: runTypeEnum('run_type').notNull().default(RunType.enum.sync),
		status: integrationStatusEnum('status').notNull().default(IntegrationStatus.enum.in_progress),
		message: text('message'),
		runStartTime: timestamp('run_start_time', {
			withTimezone: true,
		}).notNull(),
		runEndTime: timestamp('run_end_time', {
			withTimezone: true,
		}),
		entriesCreated: integer('entries_created').default(0),
		...databaseTimestampsNonUpdatable,
	},
	(table) => [index().on(table.integrationType)]
);
