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

export const integrationStatuses = ['success', 'fail', 'in_progress'] as const;
export const IntegrationStatusSchema = z.enum(integrationStatuses);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
export { IntegrationStatusSchema as IntegrationStatus };

export const integrationStatusEnum = pgEnum('integration_status', integrationStatuses);

export const integrationTypes = [
  'ai_chat',
  'airtable',
  'browser_history',
  'crawler',
  'embeddings',
  'feedbin',
  'github',
  'lightroom',
  'manual',
  'raindrop',
  'readwise',
  'twitter',
] as const;
export const IntegrationTypeSchema = z.enum(integrationTypes);
export type IntegrationType = z.infer<typeof IntegrationTypeSchema>;

export const integrationTypeEnum = pgEnum('integration_type', integrationTypes);

export const runTypes = ['seed', 'sync'] as const;
export const RunTypeSchema = z.enum(runTypes);
export type RunType = z.infer<typeof RunTypeSchema>;
export { RunTypeSchema as RunType };

export const runTypeEnum = pgEnum('run_type', runTypes);

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
    runType: runTypeEnum('run_type').notNull().default(RunTypeSchema.enum.sync),
    status: integrationStatusEnum('status')
      .notNull()
      .default(IntegrationStatusSchema.enum.in_progress),
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
