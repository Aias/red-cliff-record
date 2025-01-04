import { index, text, timestamp, integer, numeric, foreignKey, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { contentTimestamps, databaseTimestamps } from '../../operations/common';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '../schema';
import { ReadwiseLocation, ReadwiseCategory } from './types';
import { media, records } from '../../main';

export const readwiseLocationEnum = integrationSchema.enum(
	'readwise_location',
	ReadwiseLocation.options
);

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
		summary: text('summary'),
		imageUrl: text('image_url'),
		parentId: text('parent_id'),
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
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
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
		index().on(table.url),
		index().on(table.createdAt),
		index().on(table.parentId),
		index().on(table.archivedAt),
		index().on(table.recordId),
		index().on(table.mediaId),
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
	record: one(records, {
		fields: [readwiseDocuments.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [readwiseDocuments.mediaId],
		references: [media.id],
	}),
}));

export type ReadwiseDocument = typeof readwiseDocuments.$inferSelect;
export type NewReadwiseDocument = typeof readwiseDocuments.$inferInsert;
