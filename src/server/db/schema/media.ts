import { relations } from 'drizzle-orm';
import {
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { lightroomImages } from './adobe';
import { airtableAttachments } from './airtable';
import { databaseTimestamps } from './operations';
import { raindropBookmarks } from './raindrop';
import { records } from './records';
import { twitterMedia } from './twitter';

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
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		url: text('url').notNull(),
		altText: text('alt_text'),
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

export const mediaRelations = relations(media, ({ one, many }) => ({
	versionOf: one(media, {
		fields: [media.versionOfMediaId],
		references: [media.id],
		relationName: 'versionOf',
	}),
	versions: many(media, {
		relationName: 'versionOf',
	}),
	record: one(records, {
		fields: [media.recordId],
		references: [records.id],
	}),
	airtableAttachments: many(airtableAttachments),
	lightroomImages: many(lightroomImages),
	raindropBookmarks: many(raindropBookmarks),
	twitterMedia: many(twitterMedia),
}));

export const MediaSelectSchema = createSelectSchema(media);
export type MediaSelect = typeof media.$inferSelect;
export const MediaInsertSchema = createInsertSchema(media).extend({
	url: z.string().url(),
});
export type MediaInsert = typeof media.$inferInsert;
