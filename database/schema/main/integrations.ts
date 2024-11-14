import { timestamps } from '@schema/common/timestamps';
import { relations } from 'drizzle-orm';
import { serial, text, timestamp, integer, index, pgSchema } from 'drizzle-orm/pg-core';
import { browsingHistory, bookmarks } from '.';
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
	BROWSER_HISTORY = 'browser_history',
	AIRTABLE = 'airtable',
	AI_CHAT = 'ai_chat',
	RAINDROP = 'raindrop',
	GITHUB = 'github',
	TWITTER = 'twitter'
}

export const integrationTypeEnum = integrationSchema.enum('integration_type', [
	IntegrationType.BROWSER_HISTORY,
	IntegrationType.AIRTABLE,
	IntegrationType.AI_CHAT,
	IntegrationType.RAINDROP,
	IntegrationType.GITHUB,
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
	bookmarks: many(bookmarks),
	commits: many(commits),
	airtableExtracts: many(extracts),
	airtableCreators: many(creators),
	airtableSpaces: many(spaces)
}));
