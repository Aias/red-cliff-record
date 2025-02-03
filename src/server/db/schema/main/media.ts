import { relations } from 'drizzle-orm';
import {
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { databaseTimestamps } from '../common';
import { sources } from './sources';

export const MediaType = z.enum([
	'application', // application or binary data
	'audio', // audio files
	'font', // font/typeface files
	'image', // images (jpg, png, etc)
	'message', // message data
	'model', // 3D models
	'multipart', // multipart files
	'text', // plain text, markdown, etc.
	'video', // video files
]);
export type MediaType = z.infer<typeof MediaType>;

export const mediaTypeEnum = pgEnum('media_type', MediaType.options);

export const media = pgTable(
	'media',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull().unique(),
		type: mediaTypeEnum('type').notNull().default('application'),
		format: text('format').notNull().default('octet-stream'),
		contentTypeString: text('content_type_string').notNull().default('application/octet-stream'),
		title: text('title'),
		altText: text('alt_text'),
		fileSize: integer('file_size'),
		width: integer('width'),
		height: integer('height'),
		versionOfMediaId: integer('version_of_media_id').references((): AnyPgColumn => media.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		sourcePageId: integer('source_page_id').references(() => sources.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.type),
		index().on(table.format),
		index().on(table.sourcePageId),
		index().on(table.versionOfMediaId),
	]
);

export const mediaRelations = relations(media, ({ one, many }) => ({
	source: one(sources, {
		fields: [media.sourcePageId],
		references: [sources.id],
		relationName: 'sourceMedia',
	}),
	versionOf: one(media, {
		fields: [media.versionOfMediaId],
		references: [media.id],
		relationName: 'versionOf',
	}),
	versions: many(media, {
		relationName: 'versionOf',
	}),
}));

export const MediaSelectSchema = createSelectSchema(media);
export type MediaSelect = typeof media.$inferSelect;
export const MediaInsertSchema = createInsertSchema(media).extend({
	url: z.string().url(),
});
export type MediaInsert = typeof media.$inferInsert;
