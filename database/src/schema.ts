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

// Define the status enum for integration runs
export const integrationStatusEnum = pgEnum('integration_status', ['success', 'fail']);

// Integrations table
export const integrations = pgTable('integrations', {
	id: serial().primaryKey(),
	name: text().notNull(),
	description: text(),
	lastProcessed: timestamp(),
	...timestamps
});

// Integration runs table
export const integrationRuns = pgTable(
	'integration_runs',
	{
		id: serial().primaryKey(),
		integrationId: integer()
			.references(() => integrations.id)
			.notNull(),
		status: integrationStatusEnum().notNull(),
		message: text(),
		runDuration: real(),
		runStartTime: timestamp().notNull(),
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
		pageTitle: text(),
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
