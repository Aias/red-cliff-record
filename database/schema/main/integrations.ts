import { timestamps } from '@schema/common/timestamps';
import { relations } from 'drizzle-orm';
import { serial, text, timestamp, integer, index, pgSchema } from 'drizzle-orm/pg-core';
import { stars } from './github';
import { browsingHistory } from './arc';
import { commits } from './github';
import { creators, extracts, spaces } from './airtable';

export const integrationSchema = pgSchema('integrations');

export enum IntegrationStatus {
	SUCCESS = 'success',
	FAIL = 'fail',
	IN_PROGRESS = 'in_progress'
}
// Define the status enum for integration runs

export const integrationStatusEnum = integrationSchema.enum('integration_status', [
	IntegrationStatus.SUCCESS,
	IntegrationStatus.FAIL,
	IntegrationStatus.IN_PROGRESS
]);

export enum IntegrationType {
	AI_CHAT = 'ai_chat',
	AIRTABLE = 'airtable',
	BROWSER_HISTORY = 'browser_history',
	GITHUB = 'github',
	RAINDROP = 'raindrop',
	READWISE = 'readwise',
	TWITTER = 'twitter'
}

export const integrationTypeEnum = integrationSchema.enum('integration_type', [
	IntegrationType.AI_CHAT,
	IntegrationType.AIRTABLE,
	IntegrationType.BROWSER_HISTORY,
	IntegrationType.GITHUB,
	IntegrationType.RAINDROP,
	IntegrationType.READWISE,
	IntegrationType.TWITTER
]);

export enum RunType {
	FULL = 'full',
	INCREMENTAL = 'incremental'
}

export const runTypeEnum = integrationSchema.enum('run_type', [RunType.FULL, RunType.INCREMENTAL]);
// Integration runs table

export const integrationRuns = integrationSchema.table(
	'integration_runs',
	{
		id: serial().primaryKey(),
		integrationType: integrationTypeEnum().notNull(),
		runType: runTypeEnum().notNull(),
		status: integrationStatusEnum().notNull().default(IntegrationStatus.IN_PROGRESS),
		message: text(),
		runStartTime: timestamp().notNull(),
		runEndTime: timestamp(),
		entriesCreated: integer().default(0),
		...timestamps
	},
	(table) => [index().on(table.integrationType)]
);

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	browsingHistory: many(browsingHistory),
	githubStars: many(stars),
	githubCommits: many(commits),
	airtableExtracts: many(extracts),
	airtableCreators: many(creators),
	airtableSpaces: many(spaces)
}));
