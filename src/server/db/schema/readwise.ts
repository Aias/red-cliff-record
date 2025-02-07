import { relations } from 'drizzle-orm';
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
import { z } from 'zod';
import { indices } from './indices';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const ReadwiseLocation = z.enum(['new', 'later', 'shortlist', 'archive', 'feed']);
export type ReadwiseLocation = z.infer<typeof ReadwiseLocation>;

export const ReadwiseCategory = z.enum([
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
export type ReadwiseCategory = z.infer<typeof ReadwiseCategory>;

export const readwiseLocationEnum = pgEnum('readwise_location', ReadwiseLocation.options);

export const readwiseCategoryEnum = pgEnum('readwise_category', ReadwiseCategory.options);

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
		...contentTimestamps,
		...databaseTimestamps,
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		mediaId: integer('media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.sourceUrl),
		index().on(table.recordCreatedAt),
		index().on(table.parentId),
		index().on(table.recordId),
		index().on(table.mediaId),
		index().on(table.authorId),
	]
);

export const readwiseDocumentsRelations = relations(readwiseDocuments, ({ one, many }) => ({
	parent: one(readwiseDocuments, {
		fields: [readwiseDocuments.parentId],
		references: [readwiseDocuments.id],
		relationName: 'parentChild',
	}),
	children: many(readwiseDocuments, {
		relationName: 'parentChild',
	}),
	author: one(readwiseAuthors, {
		fields: [readwiseDocuments.authorId],
		references: [readwiseAuthors.id],
	}),
	documentTags: many(readwiseDocumentTags, {
		relationName: 'documentTags',
	}),
	integrationRun: one(integrationRuns, {
		fields: [readwiseDocuments.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [readwiseDocuments.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [readwiseDocuments.mediaId],
		references: [media.id],
	}),
}));

export const ReadwiseDocumentSelectSchema = createSelectSchema(readwiseDocuments);
export type ReadwiseDocumentSelect = typeof readwiseDocuments.$inferSelect;
export const ReadwiseDocumentInsertSchema = createInsertSchema(readwiseDocuments).extend({
	url: z.string().url(),
	sourceUrl: z.string().url().optional().nullable(),
	imageUrl: z.string().url().optional().nullable(),
});
export type ReadwiseDocumentInsert = typeof readwiseDocuments.$inferInsert;

export const readwiseAuthors = pgTable(
	'readwise_authors',
	{
		id: serial('id').primaryKey(),
		name: text('name'),
		domain: text('domain'),
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.name),
		index().on(table.domain),
		unique().on(table.name, table.domain),
	]
);

export const readwiseAuthorsRelations = relations(readwiseAuthors, ({ one, many }) => ({
	documents: many(readwiseDocuments),
	indexEntry: one(indices, {
		fields: [readwiseAuthors.indexEntryId],
		references: [indices.id],
	}),
}));

export const ReadwiseAuthorSelectSchema = createSelectSchema(readwiseAuthors);
export type ReadwiseAuthorSelect = typeof readwiseAuthors.$inferSelect;
export const ReadwiseAuthorInsertSchema = createInsertSchema(readwiseAuthors).extend({
	domain: z.string().url().optional().nullable(),
});
export type ReadwiseAuthorInsert = typeof readwiseAuthors.$inferInsert;

export const readwiseTags = pgTable('readwise_tags', {
	id: serial('id').primaryKey(),
	tag: text('tag').unique(),
	indexEntryId: integer('index_entry_id').references(() => indices.id, {
		onDelete: 'set null',
		onUpdate: 'cascade',
	}),
	...databaseTimestamps,
});

export const readwiseTagsRelations = relations(readwiseTags, ({ one, many }) => ({
	tagDocuments: many(readwiseDocumentTags, {
		relationName: 'tagDocuments',
	}),
	indexEntry: one(indices, {
		fields: [readwiseTags.indexEntryId],
		references: [indices.id],
	}),
}));

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

export const readwiseDocumentTagsRelations = relations(readwiseDocumentTags, ({ one }) => ({
	document: one(readwiseDocuments, {
		fields: [readwiseDocumentTags.documentId],
		references: [readwiseDocuments.id],
		relationName: 'documentTags',
	}),
	tag: one(readwiseTags, {
		fields: [readwiseDocumentTags.tagId],
		references: [readwiseTags.id],
		relationName: 'tagDocuments',
	}),
}));

export const readwiseIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	readwiseDocuments: many(readwiseDocuments),
}));
