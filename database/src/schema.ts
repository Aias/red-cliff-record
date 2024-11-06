import {
	integer,
	pgTable,
	text,
	timestamp,
	serial,
	pgEnum,
	real,
	index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from '../lib/schema-helpers';

export enum IntegrationStatus {
	SUCCESS = 'success',
	FAIL = 'fail',
	IN_PROGRESS = 'in_progress'
}

// Define the status enum for integration runs
export const integrationStatusEnum = pgEnum('integration_status', [
	IntegrationStatus.SUCCESS,
	IntegrationStatus.FAIL,
	IntegrationStatus.IN_PROGRESS
]);

export enum IntegrationType {
	BROWSER_HISTORY = 'browser_history',
	AIRTABLE = 'airtable',
	AI_CHAT = 'ai_chat',
	RAINDROP = 'raindrop'
}

export const integrationTypeEnum = pgEnum('integration_type', [
	IntegrationType.BROWSER_HISTORY,
	IntegrationType.AIRTABLE,
	IntegrationType.AI_CHAT,
	IntegrationType.RAINDROP
]);

// Integrations table
export const integrations = pgTable('integrations', {
	id: serial().primaryKey(),
	type: integrationTypeEnum().notNull(),
	description: text(),
	lastProcessed: timestamp(),
	...timestamps
});

export enum RunType {
	FULL = 'full',
	INCREMENTAL = 'incremental'
}

export const runTypeEnum = pgEnum('run_type', [RunType.FULL, RunType.INCREMENTAL]);

// Integration runs table
export const integrationRuns = pgTable(
	'integration_runs',
	{
		id: serial().primaryKey(),
		integrationId: integer()
			.references(() => integrations.id)
			.notNull(),
		type: runTypeEnum().notNull(),
		status: integrationStatusEnum().notNull().default(IntegrationStatus.IN_PROGRESS),
		message: text(),
		runStartTime: timestamp().notNull(),
		runEndTime: timestamp(),
		entriesCreated: integer().default(0),
		...timestamps
	},
	(table) => [index().on(table.integrationId)]
);

// Browsing history table
export const browsingHistory = pgTable(
	'browsing_history',
	{
		id: serial().primaryKey(),
		date: timestamp().notNull(),
		url: text().notNull(),
		pageTitle: text().notNull(),
		visitCount: integer().default(1),
		totalVisitDurationSeconds: integer(),
		searchTerms: text(),
		relatedSearches: text(),
		responseCodes: text(),
		firstVisitTime: timestamp(),
		lastVisitTime: timestamp(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps
	},
	(table) => [index().on(table.integrationRunId)]
);

// Updated relations using the new syntax
export const integrationsRelations = relations(integrations, ({ many }) => ({
	runs: many(integrationRuns)
}));

export const integrationRunsRelations = relations(integrationRuns, ({ one, many }) => ({
	integration: one(integrations, {
		fields: [integrationRuns.integrationId],
		references: [integrations.id]
	}),
	browsingHistory: many(browsingHistory)
}));

export const browsingHistoryRelations = relations(browsingHistory, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [browsingHistory.integrationRunId],
		references: [integrationRuns.id]
	})
}));
