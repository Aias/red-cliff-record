import { timestamps } from './common';
import { relations } from 'drizzle-orm';
import { serial, text, timestamp, integer, index, pgSchema } from 'drizzle-orm/pg-core';
import { stars } from './github';
import { browsingHistory } from './arc';
import { commits } from './github';
import { creators, extracts, spaces } from './airtable';
import { photographs } from './adobe';
import { z } from 'zod';

export const integrationSchema = pgSchema('integrations');

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
		id: serial().primaryKey(),
		integrationType: integrationTypeEnum().notNull(),
		runType: runTypeEnum().notNull().default(RunType.enum.sync),
		status: integrationStatusEnum().notNull().default(IntegrationStatus.enum.in_progress),
		message: text(),
		runStartTime: timestamp({
			withTimezone: true,
		}).notNull(),
		runEndTime: timestamp({
			withTimezone: true,
		}),
		entriesCreated: integer().default(0),
		...timestamps,
	},
	(table) => [index().on(table.integrationType)]
);

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(browsingHistory),
	githubStars: many(stars),
	githubCommits: many(commits),
	airtableExtracts: many(extracts),
	airtableCreators: many(creators),
	airtableSpaces: many(spaces),
	adobePhotographs: many(photographs),
}));
