import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { z } from 'zod';
import { emptyStringToNull } from '../utils/formatting';
import {
  contentTimestamps,
  databaseTimestamps,
  integrationTypeEnum,
  textEmbeddingColumns,
} from './operations';
import { predicateSlugs, type PredicateSlug } from './predicates';
import { recordTypes } from './records.shared';

export * from './predicates';
export * from './records.shared';

export const recordTypeEnum = pgEnum('record_type', recordTypes);

export const records = pgTable(
  'records',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').unique(),
    type: recordTypeEnum('type').notNull().default('artifact'),
    title: text('title'),
    sense: text('sense'),
    abbreviation: text('abbreviation'),
    url: text('url'),
    avatarUrl: text('avatar_url'),
    summary: text('summary'),
    content: text('content'),
    notes: text('notes'),
    mediaCaption: text('media_caption'),
    rating: smallint('rating').notNull().default(0),
    isPrivate: boolean('is_private').notNull().default(false),
    isCurated: boolean('is_curated').notNull().default(false),
    reminderAt: timestamp('reminder_at', { withTimezone: true }),
    sources: integrationTypeEnum('sources').array(),
    ...databaseTimestamps,
    ...contentTimestamps,
    ...textEmbeddingColumns,
  },
  (table) => [
    index().on(table.type, table.title, table.url),
    index().on(table.slug),
    index('idx_records_sources').using('gin', table.sources),
    index('idx_records_title_trgm').using('gist', table.title.op('gist_trgm_ops')),
    index('idx_records_content_trgm').using('gist', table.content.op('gist_trgm_ops')),
    index('idx_records_summary_trgm').using('gist', table.summary.op('gist_trgm_ops')),
    index('idx_records_abbreviation_trgm').using('gist', table.abbreviation.op('gist_trgm_ops')),
    index().on(table.recordCreatedAt),
    index().on(table.recordUpdatedAt),
    index().on(table.isCurated),
    index().using('hnsw', table.textEmbedding.op('vector_cosine_ops')),
  ]
);

export const RecordSelectSchema = createSelectSchema(records);
export type RecordSelect = typeof records.$inferSelect;
export const RecordInsertSchema = createInsertSchema(records).extend({
  url: emptyStringToNull(z.url()).optional(),
  avatarUrl: emptyStringToNull(z.url()).optional(),
  rating: z.number().int().min(0).max(3).default(0),
});
export type RecordInsert = typeof records.$inferInsert;

export const links = pgTable(
  'links',
  {
    id: serial('id').primaryKey(),
    sourceId: integer('source_id')
      .references(() => records.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    targetId: integer('target_id')
      .references(() => records.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    /** Predicate slug identifying the relationship type (e.g., 'contained_by', 'created_by') */
    predicate: text('predicate').notNull().$type<PredicateSlug>(),
    notes: text('notes'),
    ...databaseTimestamps,
  },
  (table) => [
    index().on(table.sourceId, table.predicate),
    index().on(table.targetId, table.predicate),
    index().on(table.predicate),
    unique().on(table.sourceId, table.targetId, table.predicate),
  ]
);

export const LinkSelectSchema = createSelectSchema(links);
export type LinkSelect = typeof links.$inferSelect;
export const LinkInsertSchema = createInsertSchema(links).extend({
  predicate: z.enum(predicateSlugs as [PredicateSlug, ...PredicateSlug[]]),
});
export type LinkInsert = z.infer<typeof LinkInsertSchema>;
