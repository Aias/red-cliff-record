import {
	pgSchema,
	index,
	text,
	timestamp,
	integer,
	numeric,
	foreignKey,
	date,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from './common';
import { integrationRuns } from './integrations';
import { z } from 'zod';

export const readwiseSchema = pgSchema('readwise');

export const ReadwiseLocation = z.enum(['new', 'later', 'shortlist', 'archive', 'feed']);

export const readwiseLocationEnum = readwiseSchema.enum('location', ReadwiseLocation.options);

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

export const readwiseCategoryEnum = readwiseSchema.enum('category', ReadwiseCategory.options);

export const documents = readwiseSchema.table(
	'documents',
	{
		id: text().primaryKey(),
		url: text(),
		sourceUrl: text(),
		title: text(),
		author: text(),
		source: text(),
		content: text(),
		category: readwiseCategoryEnum(),
		location: readwiseLocationEnum(),
		tags: text().array(),
		siteName: text(),
		wordCount: integer(),
		notes: text(),
		publishedDate: date(),
		summary: text(),
		imageUrl: text(),
		parentId: text(),
		readingProgress: numeric(),
		firstOpenedAt: timestamp({
			withTimezone: true,
		}),
		lastOpenedAt: timestamp({
			withTimezone: true,
		}),
		savedAt: timestamp({
			withTimezone: true,
		}).notNull(),
		lastMovedAt: timestamp({
			withTimezone: true,
		}).notNull(),
		integrationRunId: integer()
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

export const documentsRelations = relations(documents, ({ one, many }) => ({
	parent: one(documents, {
		fields: [documents.parentId],
		references: [documents.id],
		relationName: 'parentChild',
	}),
	children: many(documents, {
		relationName: 'parentChild',
	}),
	integrationRun: one(integrationRuns, {
		fields: [documents.integrationRunId],
		references: [integrationRuns.id],
	}),
}));
