import { timestamps } from '../../common';
import { relations } from 'drizzle-orm';
import { serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { githubStars } from '../github/schema';
import { arcBrowsingHistory } from '../arc/schema';
import { githubCommits } from '../github/schema';
import { airtableCreators, airtableExtracts, airtableSpaces } from '../airtable/schema';
import { adobeLightroomImages } from '../adobe/schema';
import { z } from 'zod';
import { integrationSchema } from '@schema/common/schemas';

export const IntegrationStatus = z.enum(['success', 'fail', 'in_progress']);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;
export const integrationStatusEnum = integrationSchema.enum(
	'integration_status',
	IntegrationStatus.options
);

export const IntegrationType = z.enum([
	'ai_chat',
	'airtable',
	'browser_history',
	'github',
	'lightroom',
	'raindrop',
	'readwise',
	'twitter',
]);
export type IntegrationType = z.infer<typeof IntegrationType>;
export const integrationTypeEnum = integrationSchema.enum(
	'integration_type',
	IntegrationType.options
);

export const RunType = z.enum(['seed', 'sync']);
export type RunType = z.infer<typeof RunType>;
export const runTypeEnum = integrationSchema.enum('run_type', RunType.options);

export const integrationRuns = integrationSchema.table(
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
