import { relations } from 'drizzle-orm';
import { pgSchema, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { githubStars } from '../integrations/github/schema';
import { arcBrowsingHistory } from '../integrations/arc/schema';
import { githubCommits } from '../integrations/github/schema';
import {
	airtableCreators,
	airtableExtracts,
	airtableSpaces,
} from '../integrations/airtable/schema';
import { adobeLightroomImages } from '../integrations/adobe/schema';
import { z } from 'zod';
import { timestamps } from './common';

export const operationsSchema = pgSchema('operations');

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
		...timestamps,
	},
	(table) => [index().on(table.integrationType)]
);

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(arcBrowsingHistory),
	githubStars: many(githubStars),
	githubCommits: many(githubCommits),
	airtableExtracts: many(airtableExtracts),
	airtableCreators: many(airtableCreators),
	airtableSpaces: many(airtableSpaces),
	adobeLightroomImages: many(adobeLightroomImages),
}));
