import { relations } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { type z } from 'zod';
import { contentTimestamps, databaseTimestamps } from '../common';
import { indexEntries, media, records } from '../main';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

export const raindropBookmarks = integrationSchema.table(
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
		unique().on(table.linkUrl, table.createdAt),
		index().on(table.integrationRunId),
		index().on(table.linkUrl),
		index().on(table.createdAt),
		index().on(table.archivedAt),
		index().on(table.recordId),
		index().on(table.mediaId),
	]
);

export const RaindropBookmarkSelectSchema = createSelectSchema(raindropBookmarks);
export type RaindropBookmarkSelect = z.infer<typeof RaindropBookmarkSelectSchema>;
export const RaindropBookmarkInsertSchema = createInsertSchema(raindropBookmarks);
export type RaindropBookmarkInsert = z.infer<typeof RaindropBookmarkInsertSchema>;
export const RaindropBookmarkUpdateSchema = createUpdateSchema(raindropBookmarks);
export type RaindropBookmarkUpdate = z.infer<typeof RaindropBookmarkUpdateSchema>;

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

export const raindropCollections = integrationSchema.table(
	'raindrop_collections',
	{
		id: integer('id').primaryKey(),
		title: text('title').notNull(),
		parentId: integer('parent_id'),
		colorHex: text('color_hex'),
		coverUrl: text('cover_url'),
		raindropCount: integer('raindrop_count'),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		indexEntryId: integer('index_entry_id').references(() => indexEntries.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
	},
	(table) => [
		index().on(table.parentId),
		foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }),
		index().on(table.archivedAt),
		index().on(table.indexEntryId),
	]
);

export const RaindropCollectionSelectSchema = createSelectSchema(raindropCollections);
export type RaindropCollectionSelect = z.infer<typeof RaindropCollectionSelectSchema>;
export const RaindropCollectionInsertSchema = createInsertSchema(raindropCollections);
export type RaindropCollectionInsert = z.infer<typeof RaindropCollectionInsertSchema>;
export const RaindropCollectionUpdateSchema = createUpdateSchema(raindropCollections);
export type RaindropCollectionUpdate = z.infer<typeof RaindropCollectionUpdateSchema>;

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
	indexEntry: one(indexEntries, {
		fields: [raindropCollections.indexEntryId],
		references: [indexEntries.id],
	}),
}));

export const raindropIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	raindropCollections: many(raindropCollections),
	raindropRaindrops: many(raindropBookmarks),
}));
