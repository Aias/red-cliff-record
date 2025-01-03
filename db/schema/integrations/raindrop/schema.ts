import { integer, text, index, boolean, unique, foreignKey, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { contentTimestamps, databaseTimestamps } from '../../operations/common';
import { integrationRuns } from '../../operations/schema';
import { integrationSchema } from '..';
import { records } from '../../main/schema';

export const raindropRaindrops = integrationSchema.table(
	'raindrop_raindrops',
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
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.linkUrl),
		index().on(table.createdAt),
		unique().on(table.linkUrl, table.createdAt),
		index().on(table.archivedAt),
		index().on(table.recordId),
	]
);

export const raindropRaindropsRelations = relations(raindropRaindrops, ({ one }) => ({
	collection: one(raindropCollections, {
		fields: [raindropRaindrops.collectionId],
		references: [raindropCollections.id],
	}),
	integrationRun: one(integrationRuns, {
		fields: [raindropRaindrops.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [raindropRaindrops.recordId],
		references: [records.id],
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
	},
	(table) => [
		index().on(table.parentId),
		foreignKey({ columns: [table.parentId], foreignColumns: [table.id] }),
	]
);

export const raindropCollectionsRelations = relations(raindropCollections, ({ one, many }) => ({
	raindrops: many(raindropRaindrops),
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
}));

export type RaindropRaindrop = typeof raindropRaindrops.$inferSelect;
export type NewRaindropRaindrop = typeof raindropRaindrops.$inferInsert;
export type RaindropCollection = typeof raindropCollections.$inferSelect;
export type NewRaindropCollection = typeof raindropCollections.$inferInsert;
