import {
	integer,
	pgTable,
	text,
	timestamp,
	serial,
	index,
	boolean,
	unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from '../common/timestamps';
import { integrationRuns } from './integrations';

export const bookmarks = pgTable(
	'bookmarks',
	{
		id: serial().primaryKey(),
		url: text().notNull(),
		title: text().notNull(),
		creator: text(),
		content: text(),
		notes: text(),
		type: text(),
		category: text(),
		tags: text().array(),
		important: boolean().notNull().default(false),
		imageUrl: text(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		bookmarkedAt: timestamp().defaultNow().notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.url),
		index().on(table.createdAt),
		unique().on(table.url, table.bookmarkedAt)
	]
);

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [bookmarks.integrationRunId],
		references: [integrationRuns.id]
	})
}));
