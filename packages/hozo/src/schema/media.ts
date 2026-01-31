import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { mediaTypes } from './media.shared';
import { databaseTimestamps } from './operations';
import { records } from './records';

export * from './media.shared';

export const mediaTypeEnum = pgEnum('media_type', mediaTypes);

export const media = pgTable(
  'media',
  {
    id: serial('id').primaryKey(),
    recordId: integer('record_id').references(() => records.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    url: text('url').notNull(),
    altText: text('alt_text'),
    altTextGeneratedAt: timestamp('alt_text_generated_at', { withTimezone: true }),
    type: mediaTypeEnum('type').notNull().default('application'),
    format: text('format').notNull().default('octet-stream'),
    contentTypeString: text('content_type_string').notNull().default('application/octet-stream'),
    fileSize: integer('file_size'),
    width: integer('width'),
    height: integer('height'),
    versionOfMediaId: integer('version_of_media_id').references((): AnyPgColumn => media.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),
    ...databaseTimestamps,
  },
  (table) => [
    unique().on(table.url, table.recordId),
    index().on(table.recordId),
    index().on(table.type, table.format, table.contentTypeString),
    index().on(table.url),
    index().on(table.versionOfMediaId),
  ]
);

export const MediaSelectSchema = createSelectSchema(media);
export type MediaSelect = typeof media.$inferSelect;
export const MediaInsertSchema = createInsertSchema(media).extend({
  url: z.url(),
});
export type MediaInsert = typeof media.$inferInsert;
