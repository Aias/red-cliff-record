import { relations } from 'drizzle-orm';
import {
	boolean,
	foreignKey,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { databaseTimestamps } from '../common';
import { media } from './media';
import { sources } from './sources';

export const IndexMainType = z.enum([
	'entity', // who/what created something
	'category', // what something is about
	'format', // what something is
]);
export type IndexMainType = z.infer<typeof IndexMainType>;

export const IndexRelationType = z.enum(['related_to', 'opposite_of', 'part_of']);
export type IndexRelationType = z.infer<typeof IndexRelationType>;

export const indexMainTypeEnum = pgEnum('index_main_type', IndexMainType.options);
export const indexRelationTypeEnum = pgEnum('index_relation_type', IndexRelationType.options);

// Main index table
export const indices = pgTable(
	'indices',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		shortName: text('short_name'),
		sense: text('sense'),
		notes: text('notes'),
		private: boolean('private').notNull().default(false),
		mainType: indexMainTypeEnum('main_type').notNull(),
		subType: text('sub_type'),
		canonicalPageId: integer('canonical_page_id').references(() => sources.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		canonicalMediaId: integer('canonical_media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		aliasOf: integer('alias_of'),
		...databaseTimestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.aliasOf],
			foreignColumns: [table.id],
		}),
		unique().on(table.name, table.sense, table.mainType),
		index().on(table.mainType, table.subType),
		index().on(table.canonicalPageId),
		index().on(table.canonicalMediaId),
	]
);

export const IndicesSelectSchema = createSelectSchema(indices);
export type IndicesSelect = z.infer<typeof IndicesSelectSchema>;
export const IndicesInsertSchema = createInsertSchema(indices);
export type IndicesInsert = z.infer<typeof IndicesInsertSchema>;
export const IndicesUpdateSchema = createUpdateSchema(indices);
export type IndicesUpdate = z.infer<typeof IndicesUpdateSchema>;

// See-also relationships
export const indexRelations = pgTable(
	'index_relations',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => indices.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		targetId: integer('target_id')
			.references(() => indices.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		type: indexRelationTypeEnum('type').notNull().default('related_to'),
		...databaseTimestamps,
	},
	(table) => [unique().on(table.sourceId, table.targetId, table.type)]
);

export const IndexRelationSelectSchema = createSelectSchema(indexRelations);
export type IndexRelationSelect = z.infer<typeof IndexRelationSelectSchema>;
export const IndexRelationInsertSchema = createInsertSchema(indexRelations);
export type IndexRelationInsert = z.infer<typeof IndexRelationInsertSchema>;
export const IndexRelationUpdateSchema = createUpdateSchema(indexRelations);
export type IndexRelationUpdate = z.infer<typeof IndexRelationUpdateSchema>;

// Relations
export const indexEntriesRelations = relations(indices, ({ one, many }) => ({
	canonicalPage: one(sources, {
		fields: [indices.canonicalPageId],
		references: [sources.id],
	}),
	canonicalMedia: one(media, {
		fields: [indices.canonicalMediaId],
		references: [media.id],
	}),
	alias: one(indices, {
		fields: [indices.aliasOf],
		references: [indices.id],
		relationName: 'aliasRelation',
	}),
	aliases: many(indices, {
		relationName: 'aliasRelation',
	}),
	outgoingRelations: many(indexRelations, {
		relationName: 'source',
	}),
	incomingRelations: many(indexRelations, {
		relationName: 'target',
	}),
}));

export const indexRelationsRelations = relations(indexRelations, ({ one }) => ({
	source: one(indices, {
		fields: [indexRelations.sourceId],
		references: [indices.id],
		relationName: 'source',
	}),
	target: one(indices, {
		fields: [indexRelations.targetId],
		references: [indices.id],
		relationName: 'target',
	}),
}));
