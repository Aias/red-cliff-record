import { relations } from 'drizzle-orm';
import {
	foreignKey,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	serial,
	text,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { databaseTimestamps } from '../common';
import { sources } from './sources';

export const MediaFormat = z.enum([
	'image', // images (jpg, png, etc)
	'video', // video files
	'audio', // audio files
	'text', // plain text, markdown
	'application', // binary data, PDFs, etc
	'unknown', // unknown format
]);
export type MediaFormat = z.infer<typeof MediaFormat>;

export const mediaFormatEnum = pgEnum('media_format', MediaFormat.options);

export const media = pgTable(
	'media',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull().unique(),
		format: mediaFormatEnum('format').notNull(),
		mimeType: text('mime_type').notNull(),
		title: text('title'),
		altText: text('alt_text'),
		fileSize: integer('file_size'),
		width: integer('width'),
		height: integer('height'),
		versionOfMediaId: integer('version_of_media_id'),
		sourcePageId: integer('source_page_id').references(() => sources.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		metadata: json('metadata'),
		...databaseTimestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.versionOfMediaId],
			foreignColumns: [table.id],
		}),
		index().on(table.format),
		index().on(table.mimeType),
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
