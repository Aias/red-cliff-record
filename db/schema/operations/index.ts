import { serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { databaseTimestampsNonUpdatable } from './common';
import { operationsSchema, integrationTypeEnum } from './schema';
import { IntegrationStatus, RunType } from './types';

export { operationsSchema, integrationTypeEnum };

export const integrationStatusEnum = operationsSchema.enum(
	'integration_status',
	IntegrationStatus.options
);

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
