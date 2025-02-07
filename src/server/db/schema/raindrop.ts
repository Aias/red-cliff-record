import { relations } from 'drizzle-orm';
import {
	boolean,
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
import { indices } from './indices';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const RaindropType = z.enum(['link', 'document', 'video', 'image', 'audio', 'article']);
export type RaindropType = z.infer<typeof RaindropType>;
export const raindropTypeEnum = pgEnum('raindrop_type', RaindropType.options);

export const raindropBookmarks = pgTable(
	'raindrop_bookmarks',
	{
		id: integer('id').primaryKey(),
		linkUrl: text('link_url').notNull(),
		title: text('title').notNull(),
		excerpt: text('excerpt'),
		note: text('note'),
		type: raindropTypeEnum('type'),
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

export const raindropBookmarksRelations = relations(raindropBookmarks, ({ one, many }) => ({
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
	bookmarkTags: many(raindropBookmarkTags, {
		relationName: 'bookmarkTags',
	}),
}));

export const RaindropBookmarkSelectSchema = createSelectSchema(raindropBookmarks);
export type RaindropBookmarkSelect = typeof raindropBookmarks.$inferSelect;
export const RaindropBookmarkInsertSchema = createInsertSchema(raindropBookmarks).extend({
	linkUrl: z.string().url(),
	coverImageUrl: z.string().url().optional().nullable(),
});
export type RaindropBookmarkInsert = typeof raindropBookmarks.$inferInsert;

export const raindropTags = pgTable(
	'raindrop_tags',
	{
		id: serial('id').primaryKey(),
		tag: text('tag').notNull().unique(),
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
	},
	(table) => [index().on(table.tag), index().on(table.indexEntryId)]
);

export const RaindropTagSelectSchema = createSelectSchema(raindropTags);
export type RaindropTagSelect = typeof raindropTags.$inferSelect;
export const RaindropTagInsertSchema = createInsertSchema(raindropTags);
export type RaindropTagInsert = typeof raindropTags.$inferInsert;

export const raindropTagsRelations = relations(raindropTags, ({ one, many }) => ({
	tagBookmarks: many(raindropBookmarkTags, {
		relationName: 'tagBookmarks',
	}),
	indexEntry: one(indices, {
		fields: [raindropTags.indexEntryId],
		references: [indices.id],
	}),
}));

export const raindropBookmarkTags = pgTable(
	'raindrop_bookmark_tags',
	{
		id: serial('id').primaryKey(),
		bookmarkId: integer('bookmark_id')
			.notNull()
			.references(() => raindropBookmarks.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			}),
		tagId: integer('tag_id')
			.notNull()
			.references(() => raindropTags.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			}),
		...databaseTimestamps,
	},
	(table) => [
		unique().on(table.bookmarkId, table.tagId),
		index().on(table.bookmarkId),
		index().on(table.tagId),
	]
);

export const raindropBookmarkTagsRelations = relations(raindropBookmarkTags, ({ one }) => ({
	bookmark: one(raindropBookmarks, {
		fields: [raindropBookmarkTags.bookmarkId],
		references: [raindropBookmarks.id],
		relationName: 'bookmarkTags',
	}),
	tag: one(raindropTags, {
		fields: [raindropBookmarkTags.tagId],
		references: [raindropTags.id],
		relationName: 'tagBookmarks',
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
		indexEntryId: integer('index_entry_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.parentId), index().on(table.indexEntryId)]
);

export const RaindropCollectionSelectSchema = createSelectSchema(raindropCollections);
export type RaindropCollectionSelect = typeof raindropCollections.$inferSelect;
export const RaindropCollectionInsertSchema = createInsertSchema(raindropCollections).extend({
	coverUrl: z.string().url().optional().nullable(),
});
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
