import { relations } from 'drizzle-orm';
import { pgSchema, serial, text, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { arcBrowsingHistory } from '../integrations/arc/schema';
import { githubCommits, githubRepositories } from '../integrations/github/schema';
import {
	airtableCreators,
	airtableExtracts,
	airtableSpaces,
} from '../integrations/airtable/schema';
import { adobeLightroomImages } from '../integrations/adobe/schema';
import { raindropCollections, raindropRaindrops } from '../integrations/raindrop/schema';
import { readwiseDocuments } from '../integrations/readwise/schema';
import { twitterTweets, twitterUsers } from '../integrations/twitter/schema';
import { databaseTimestampsNonUpdatable } from './common';
import { IntegrationStatus, IntegrationType, RunType } from './types';

export const operationsSchema = pgSchema('operations');

export const integrationStatusEnum = operationsSchema.enum(
	'integration_status',
	IntegrationStatus.options
);

export const integrationTypeEnum = operationsSchema.enum(
	'integration_type',
	IntegrationType.options
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

export const integrationRunsRelations = relations(integrationRuns, ({ many }) => ({
	adobeLightroomImages: many(adobeLightroomImages),
	airtableExtracts: many(airtableExtracts),
	airtableCreators: many(airtableCreators),
	airtableSpaces: many(airtableSpaces),
	arcBrowsingHistory: many(arcBrowsingHistory),
	githubCommits: many(githubCommits),
	githubRepositories: many(githubRepositories),
	raindropCollections: many(raindropCollections),
	raindropRaindrops: many(raindropRaindrops),
	readwiseDocuments: many(readwiseDocuments),
	tweets: many(twitterTweets),
	twitterUsers: many(twitterUsers),
}));
