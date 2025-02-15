import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	vector,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const IntegrationStatus = z.enum(['success', 'fail', 'in_progress']);
export type IntegrationStatus = z.infer<typeof IntegrationStatus>;

export const integrationStatusEnum = pgEnum('integration_status', IntegrationStatus.options);

export const IntegrationType = z.enum([
	'ai_chat',
	'airtable',
	'browser_history',
	'crawler',
	'embeddings',
	'github',
	'lightroom',
	'manual',
	'raindrop',
	'readwise',
	'twitter',
]);
export type IntegrationType = z.infer<typeof IntegrationType>;
export const integrationTypeEnum = pgEnum('integration_type', IntegrationType.options);

export const RunType = z.enum(['seed', 'sync']);
export type RunType = z.infer<typeof RunType>;
export const runTypeEnum = pgEnum('run_type', RunType.options);

export const FLAGS = {
	important: {
		name: 'Important',
		emoji: '⭐',
		description: 'Important content',
	},
	favorite: {
		name: 'Favorite',
		emoji: '💖',
		description: 'Favorite content',
	},
	draft: {
		name: 'Draft',
		emoji: '📝',
		description: 'Work in progress',
	},
	follow_up: {
		name: 'Follow-up',
		emoji: '🚩',
		description: 'Needs further action',
	},
	review: {
		name: 'Review',
		emoji: '⏲️',
		description: 'Marked for later review',
	},
	outdated: {
		name: 'Outdated',
		emoji: '📅',
		description: 'Content needs updating',
	},
	disagree: {
		name: 'Disagree',
		emoji: '👎',
		description: "Does not reflect the curator's views or beliefs",
	},
} as const;

export const Flag = z.enum(
	Object.keys(FLAGS) as [keyof typeof FLAGS, ...Array<keyof typeof FLAGS>]
);
export type Flag = z.infer<typeof Flag>;
export const flagEnum = pgEnum('flag', Flag.options);

export type FlagData = typeof FLAGS;
export type FlagKey = keyof FlagData;

const recordCreatedAt = timestamp('created_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();
const recordUpdatedAt = timestamp('updated_at', {
	withTimezone: true,
})
	.defaultNow()
	.notNull();

export const databaseTimestamps = {
	recordCreatedAt,
	recordUpdatedAt,
};

export const databaseTimestampsNonUpdatable = {
	recordCreatedAt,
};
const contentCreatedAt = timestamp('content_created_at', {
	withTimezone: true,
});
const contentUpdatedAt = timestamp('content_updated_at', {
	withTimezone: true,
});

export const contentTimestamps = {
	contentCreatedAt,
	contentUpdatedAt,
};

export const contentTimestampsNonUpdatable = {
	contentCreatedAt,
};
const needsCuration = boolean('needs_curation').notNull().default(true);
const isPrivate = boolean('is_private').notNull().default(false);

export const commonColumns = {
	needsCuration,
	isPrivate,
	sources: integrationTypeEnum('sources').array(),
};

export const TEXT_EMBEDDING_DIMENSIONS = 768;
const textEmbedding = vector('text_embedding', { dimensions: TEXT_EMBEDDING_DIMENSIONS });

export const textEmbeddingColumns = {
	textEmbedding: textEmbedding,
};

export const integrationRuns = pgTable(
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

export const IntegrationRunSelectSchema = createSelectSchema(integrationRuns);
export type IntegrationRunSelect = typeof integrationRuns.$inferSelect;
export const IntegrationRunInsertSchema = createInsertSchema(integrationRuns);
export type IntegrationRunInsert = typeof integrationRuns.$inferInsert;
