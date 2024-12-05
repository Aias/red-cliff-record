import { index, text, timestamp, integer, numeric, foreignKey, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from '../../common';
import { integrationRuns } from '../operations/schema';
import { integrationSchema } from '../../common/schemas';
import { z } from 'zod';

export const ReadwiseLocation = z.enum(['new', 'later', 'shortlist', 'archive', 'feed']);
export type ReadwiseLocation = z.infer<typeof ReadwiseLocation>;
export const readwiseLocationEnum = integrationSchema.enum(
	'readwise_location',
	ReadwiseLocation.options
);

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
export const readwiseCategoryEnum = integrationSchema.enum(
	'readwise_category',
	ReadwiseCategory.options
);

export const readwiseDocuments = integrationSchema.table(
	'readwise_documents',
	{
		id: text('id').primaryKey(),
		url: text('url'),
		sourceUrl: text('source_url'),
		title: text('title'),
		author: text('author'),
		source: text('source'),
		content: text('content'),
		category: readwiseCategoryEnum(),
		location: readwiseLocationEnum(),
		tags: text('tags').array(),
		siteName: text('site_name'),
		wordCount: integer('word_count'),
		notes: text('notes'),
		publishedDate: date('published_date'),
		summary: text('summary'),
		imageUrl: text('image_url'),
		parentId: text('parent_id'),
		readingProgress: numeric('reading_progress'),
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
		...timestamps,
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.url),
		index().on(table.createdAt),
		index().on(table.parentId),
		foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
		}),
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
	integrationRun: one(integrationRuns, {
		fields: [readwiseDocuments.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export type ReadwiseDocument = typeof readwiseDocuments.$inferSelect;
export type NewReadwiseDocument = typeof readwiseDocuments.$inferInsert;
