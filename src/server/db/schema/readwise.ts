import {
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const readwiseLocationEnum = pgEnum('readwise_location', [
	'new',
	'later',
	'shortlist',
	'archive',
	'feed',
]);
export const ReadwiseLocation = z.enum(readwiseLocationEnum.enumValues);
export type ReadwiseLocation = z.infer<typeof ReadwiseLocation>;

export const readwiseCategoryEnum = pgEnum('readwise_category', [
	'article',
	'email',
	'rss',
	'highlight',
	'note',
	'pdf',
	'epub',
	'tweet',
	'video',
]);
export const ReadwiseCategory = z.enum(readwiseCategoryEnum.enumValues);
export type ReadwiseCategory = z.infer<typeof ReadwiseCategory>;

export const readwiseDocuments = pgTable(
	'readwise_documents',
	{
		id: text('id').primaryKey(),
		url: text('url').notNull(),
		sourceUrl: text('source_url'),
		title: text('title'),
		author: text('author'),
		authorId: integer('author_id').references(() => readwiseAuthors.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		source: text('source'),
		content: text('content'),
		htmlContent: text('html_content'),
		category: readwiseCategoryEnum(),
		location: readwiseLocationEnum(),
		tags: text('tags').array(),
		siteName: text('site_name'),
		wordCount: integer('word_count'),
		notes: text('notes'),
		summary: text('summary'),
		imageUrl: text('image_url'),
		parentId: text('parent_id').references((): AnyPgColumn => readwiseDocuments.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		readingProgress: numeric('reading_progress'),
		publishedDate: date('published_date'),
		firstOpenedAt: timestamp('first_opened_at', {
			withTimezone: true,
		}),
		lastOpenedAt: timestamp('last_opened_at', {
			withTimezone: true,
		}),
		savedAt: timestamp('saved_at', {
			withTimezone: true,
		}).notNull(),
		lastMovedAt: timestamp('last_moved_at', {
			withTimezone: true,
		}).notNull(),
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
	(table) => [
		index().on(table.parentId),
		index().on(table.recordId),
		index().on(table.authorId),
		index().on(table.deletedAt),
	]
);

export const ReadwiseDocumentSelectSchema = createSelectSchema(readwiseDocuments);
export type ReadwiseDocumentSelect = typeof readwiseDocuments.$inferSelect;
export const ReadwiseDocumentInsertSchema = createInsertSchema(readwiseDocuments).extend({
	url: z.url(),
	sourceUrl: z.url().optional().nullable(),
	imageUrl: z.url().optional().nullable(),
});
export type ReadwiseDocumentInsert = typeof readwiseDocuments.$inferInsert;

export const readwiseAuthors = pgTable(
	'readwise_authors',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		origin: text('origin'),
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		deletedAt: timestamp('deleted_at', {
			withTimezone: true,
		}),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.name),
		index().on(table.origin),
		unique().on(table.name, table.origin),
		index().on(table.deletedAt),
	]
);

export const ReadwiseAuthorSelectSchema = createSelectSchema(readwiseAuthors);
export type ReadwiseAuthorSelect = typeof readwiseAuthors.$inferSelect;
export const ReadwiseAuthorInsertSchema = createInsertSchema(readwiseAuthors).extend({
	origin: z.url().optional().nullable(),
});
export type ReadwiseAuthorInsert = typeof readwiseAuthors.$inferInsert;

export const readwiseTags = pgTable(
	'readwise_tags',
	{
		id: serial('id').primaryKey(),
		tag: text('tag').unique().notNull(),
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		deletedAt: timestamp('deleted_at', {
			withTimezone: true,
		}),
		...databaseTimestamps,
	},
	(table) => [index().on(table.deletedAt)]
);

export const ReadwiseTagSelectSchema = createSelectSchema(readwiseTags);
export type ReadwiseTagSelect = typeof readwiseTags.$inferSelect;
export const ReadwiseTagInsertSchema = createInsertSchema(readwiseTags);
export type ReadwiseTagInsert = typeof readwiseTags.$inferInsert;

// Combined hierarchy/relations table
export const readwiseDocumentTags = pgTable(
	'readwise_document_tags',
	{
		id: serial('id').primaryKey(),
		documentId: text('document_id')
			.notNull()
			.references(() => readwiseDocuments.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		tagId: integer('tag_id')
			.notNull()
			.references(() => readwiseTags.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			}),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.documentId),
		index().on(table.tagId),
		unique().on(table.documentId, table.tagId),
	]
);
