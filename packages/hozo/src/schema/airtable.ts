import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const airtableExtracts = pgTable(
  'airtable_extracts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    formatString: text('format_string').notNull().default('Fragment'),
    formatId: integer('format_id').references(() => airtableFormats.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    source: text('source'),
    michelinStars: integer('michelin_stars').notNull().default(0),
    content: text('content'),
    notes: text('notes'),
    attachmentCaption: text('attachment_caption'),
    parentId: text('parent_id').references((): AnyPgColumn => airtableExtracts.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    lexicographicalOrder: text('lexicographical_order').notNull().default('a0'),
    integrationRunId: integer('integration_run_id')
      .references(() => integrationRuns.id)
      .notNull(),
    publishedAt: timestamp('published_at', {
      withTimezone: true,
    }),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }),
    ...contentTimestamps,
    ...databaseTimestamps,
  },
  (table) => [index().on(table.recordId), index().on(table.deletedAt)]
);

export const AirtableExtractSelectSchema = createSelectSchema(airtableExtracts);
export type AirtableExtractSelect = typeof airtableExtracts.$inferSelect;
export const AirtableExtractInsertSchema = createInsertSchema(airtableExtracts);
export type AirtableExtractInsert = typeof airtableExtracts.$inferInsert;

export const airtableFormats = pgTable(
  'airtable_formats',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    integrationRunId: integer('integration_run_id')
      .references(() => integrationRuns.id)
      .notNull(),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }),
    ...databaseTimestamps,
  },
  (table) => [index().on(table.recordId), index().on(table.deletedAt)]
);

export const AirtableFormatSelectSchema = createSelectSchema(airtableFormats);
export type AirtableFormatSelect = typeof airtableFormats.$inferSelect;
export const AirtableFormatInsertSchema = createInsertSchema(airtableFormats);
export type AirtableFormatInsert = typeof airtableFormats.$inferInsert;

export const airtableAttachments = pgTable(
  'airtable_attachments',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    filename: text('filename').notNull(),
    size: integer('size'),
    type: text('type'),
    width: integer('width'),
    height: integer('height'),
    extractId: text('extract_id')
      .references(() => airtableExtracts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    mediaId: integer('media_id').references(() => media.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }),
    ...databaseTimestamps,
  },
  (table) => [index().on(table.mediaId), index().on(table.deletedAt)]
);

export const AirtableAttachmentSelectSchema = createSelectSchema(airtableAttachments);
export type AirtableAttachmentSelect = typeof airtableAttachments.$inferSelect;
export const AirtableAttachmentInsertSchema = createInsertSchema(airtableAttachments);
export type AirtableAttachmentInsert = typeof airtableAttachments.$inferInsert;

export const airtableCreators = pgTable(
  'airtable_creators',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull().default('Individual'),
    primaryProject: text('primary_project'),
    website: text('website'),
    professions: text('professions').array(),
    organizations: text('organizations').array(),
    nationalities: text('nationalities').array(),
    integrationRunId: integer('integration_run_id')
      .references(() => integrationRuns.id)
      .notNull(),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }),
    ...contentTimestamps,
    ...databaseTimestamps,
  },
  (table) => [index().on(table.recordId), index().on(table.deletedAt)]
);

export const AirtableCreatorSelectSchema = createSelectSchema(airtableCreators);
export type AirtableCreatorSelect = typeof airtableCreators.$inferSelect;
export const AirtableCreatorInsertSchema = createInsertSchema(airtableCreators);
export type AirtableCreatorInsert = typeof airtableCreators.$inferInsert;

export const airtableSpaces = pgTable(
  'airtable_spaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    fullName: text('full_name'),
    icon: text('icon'),
    integrationRunId: integer('integration_run_id')
      .references(() => integrationRuns.id)
      .notNull(),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    deletedAt: timestamp('deleted_at', {
      withTimezone: true,
    }),
    ...contentTimestamps,
    ...databaseTimestamps,
  },
  (table) => [index().on(table.recordId), index().on(table.deletedAt)]
);

export const AirtableSpaceSelectSchema = createSelectSchema(airtableSpaces);
export type AirtableSpaceSelect = typeof airtableSpaces.$inferSelect;
export const AirtableSpaceInsertSchema = createInsertSchema(airtableSpaces);
export type AirtableSpaceInsert = typeof airtableSpaces.$inferInsert;

export const airtableExtractCreators = pgTable(
  'airtable_extract_creators',
  {
    extractId: text('extract_id')
      .references(() => airtableExtracts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    creatorId: text('creator_id')
      .references(() => airtableCreators.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    ...databaseTimestamps,
  },
  (table) => [primaryKey({ columns: [table.extractId, table.creatorId] })]
);

export const AirtableExtractCreatorSelectSchema = createSelectSchema(airtableExtractCreators);
export type AirtableExtractCreatorSelect = typeof airtableExtractCreators.$inferSelect;
export const AirtableExtractCreatorInsertSchema = createInsertSchema(airtableExtractCreators);
export type AirtableExtractCreatorInsert = typeof airtableExtractCreators.$inferInsert;

export const airtableExtractSpaces = pgTable(
  'airtable_extract_spaces',
  {
    extractId: text('extract_id')
      .references(() => airtableExtracts.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    spaceId: text('space_id')
      .references(() => airtableSpaces.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    ...databaseTimestamps,
  },
  (table) => [primaryKey({ columns: [table.extractId, table.spaceId] })]
);

export const AirtableExtractSpaceSelectSchema = createSelectSchema(airtableExtractSpaces);
export type AirtableExtractSpaceSelect = typeof airtableExtractSpaces.$inferSelect;
export const AirtableExtractSpaceInsertSchema = createInsertSchema(airtableExtractSpaces);
export type AirtableExtractSpaceInsert = typeof airtableExtractSpaces.$inferInsert;

export const airtableExtractConnections = pgTable(
  'airtable_extract_connections',
  {
    fromExtractId: text('from_extract_id').notNull(),
    toExtractId: text('to_extract_id').notNull(),
    ...databaseTimestamps,
  },
  (table) => [
    // Define these foreign keys manually since the auto-generated names are too long
    foreignKey({
      name: 'airtable_extract_connections_from_extract_fk',
      columns: [table.fromExtractId],
      foreignColumns: [airtableExtracts.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({
      name: 'airtable_extract_connections_to_extract_fk',
      columns: [table.toExtractId],
      foreignColumns: [airtableExtracts.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    primaryKey({ columns: [table.fromExtractId, table.toExtractId] }),
  ]
);

export const AirtableExtractConnectionSelectSchema = createSelectSchema(airtableExtractConnections);
export type AirtableExtractConnectionSelect = typeof airtableExtractConnections.$inferSelect;
export const AirtableExtractConnectionInsertSchema = createInsertSchema(airtableExtractConnections);
export type AirtableExtractConnectionInsert = typeof airtableExtractConnections.$inferInsert;
