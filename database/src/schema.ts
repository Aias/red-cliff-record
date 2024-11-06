import {
	integer,
	pgTable,
	text,
	timestamp,
	serial,
	pgEnum,
	index,
	pgMaterializedView
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
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

export enum Browser {
	ARC = 'arc',
	CHROME = 'chrome',
	FIREFOX = 'firefox',
	SAFARI = 'safari',
	EDGE = 'edge'
}

export const browserEnum = pgEnum('browser', [
	Browser.ARC,
	Browser.CHROME,
	Browser.FIREFOX,
	Browser.SAFARI,
	Browser.EDGE
]);

// Browsing history table
export const browsingHistory = pgTable(
	'browsing_history',
	{
		id: serial().primaryKey(),
		browser: browserEnum().notNull().default(Browser.ARC),
		viewTime: timestamp().notNull(),
		viewDuration: integer(),
		durationSinceLastView: integer(),
		url: text().notNull(),
		pageTitle: text().notNull(),
		searchTerms: text(),
		relatedSearches: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps
	},
	(table) => [index().on(table.integrationRunId), index().on(table.viewTime), index().on(table.url)]
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
