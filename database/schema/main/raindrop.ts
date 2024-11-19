import { pgSchema, integer, text, index, boolean, unique, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { timestamps } from '../common/timestamps';
import { integrationRuns } from './integrations';

export const raindropSchema = pgSchema('raindrop');

export const raindrops = raindropSchema.table(
	'raindrops',
	{
		id: integer().primaryKey(),
		linkUrl: text().notNull(),
		title: text().notNull(),
		excerpt: text(),
		note: text(),
		type: text(),
		coverImageUrl: text(),
		tags: text().array(),
		important: boolean().notNull().default(false),
		domain: text(),
		collectionId: integer().references(() => collections.id),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.linkUrl),
		index().on(table.createdAt),
		unique().on(table.linkUrl, table.createdAt)
	]
);

export const raindropsRelations = relations(raindrops, ({ one }) => ({
	collection: one(collections, {
		fields: [raindrops.collectionId],
		references: [collections.id]
	}),
	integrationRun: one(integrationRuns, {
		fields: [raindrops.integrationRunId],
		references: [integrationRuns.id]
	})
}));

export const collections = raindropSchema.table(
	'collections',
	{
		id: integer().primaryKey(),
		title: text().notNull(),
		parentId: integer(),
		colorHex: text(),
		coverUrl: text(),
		raindropCount: integer(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps
	},
	(table) => [
		index().on(table.parentId),
		foreignKey({ columns: [table.parentId], foreignColumns: [table.id] })
	]
);

export const collectionsRelations = relations(collections, ({ one, many }) => ({
	raindrops: many(raindrops),
	children: many(collections, { relationName: 'parentCollection' }),
	parent: one(collections, {
		fields: [collections.parentId],
		references: [collections.id],
		relationName: 'parentCollection'
	}),
	integrationRun: one(integrationRuns, {
		fields: [collections.integrationRunId],
		references: [integrationRuns.id]
	})
}));
