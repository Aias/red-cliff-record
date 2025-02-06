import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { contentTimestamps, databaseTimestamps } from './common';
import { indices } from './indices';
import { media } from './media';
import { integrationRuns } from './operations';
import { records } from './records';

export const raindropBookmarks = pgTable(
	'raindrop_bookmarks',
	{
		id: integer('id').primaryKey(),
		linkUrl: text('link_url').notNull(),
		title: text('title').notNull(),
		excerpt: text('excerpt'),
		note: text('note'),
		type: text('type'),
		coverImageUrl: text('cover_image_url'),
		tags: text('tags').array(),
		important: boolean('important').notNull().default(false),
		domain: text('domain'),
		collectionId: integer('collection_id').references(() => raindropCollections.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
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
		unique().on(table.linkUrl, table.recordCreatedAt),
		index().on(table.integrationRunId),
		index().on(table.linkUrl),
		index().on(table.recordCreatedAt),
		index().on(table.recordId),
		index().on(table.mediaId),
	]
);

export const RaindropBookmarkSelectSchema = createSelectSchema(raindropBookmarks);
export type RaindropBookmarkSelect = typeof raindropBookmarks.$inferSelect;
export const RaindropBookmarkInsertSchema = createInsertSchema(raindropBookmarks);
export type RaindropBookmarkInsert = typeof raindropBookmarks.$inferInsert;

export const raindropBookmarksRelations = relations(raindropBookmarks, ({ one }) => ({
	collection: one(raindropCollections, {
		fields: [raindropBookmarks.collectionId],
		references: [raindropCollections.id],
	}),
	integrationRun: one(integrationRuns, {
		fields: [raindropBookmarks.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [raindropBookmarks.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [raindropBookmarks.mediaId],
		references: [media.id],
	}),
}));

export const raindropCollections = pgTable(
	'raindrop_collections',
	{
		id: integer('id').primaryKey(),
		title: text('title').notNull(),
		parentId: integer('parent_id').references((): AnyPgColumn => raindropCollections.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		colorHex: text('color_hex'),
		coverUrl: text('cover_url'),
		raindropCount: integer('raindrop_count'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [index().on(table.parentId), index().on(table.indexEntryId)]
);

export const RaindropCollectionSelectSchema = createSelectSchema(raindropCollections);
export type RaindropCollectionSelect = typeof raindropCollections.$inferSelect;
export const RaindropCollectionInsertSchema = createInsertSchema(raindropCollections);
export type RaindropCollectionInsert = typeof raindropCollections.$inferInsert;

export const raindropCollectionsRelations = relations(raindropCollections, ({ one, many }) => ({
	raindrops: many(raindropBookmarks),
	children: many(raindropCollections, { relationName: 'parentCollection' }),
	parent: one(raindropCollections, {
		fields: [raindropCollections.parentId],
		references: [raindropCollections.id],
		relationName: 'parentCollection',
	}),
	integrationRun: one(integrationRuns, {
		fields: [raindropCollections.integrationRunId],
		references: [integrationRuns.id],
	}),
	indexEntry: one(indices, {
		fields: [raindropCollections.indexEntryId],
		references: [indices.id],
	}),
}));

export const raindropIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	raindropCollections: many(raindropCollections),
	raindropRaindrops: many(raindropBookmarks),
}));
