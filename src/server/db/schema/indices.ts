import { relations } from 'drizzle-orm';
import {
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
import { airtableCreators, airtableFormats, airtableSpaces } from './airtable';
import { githubUsers } from './github';
import { media } from './media';
import {
	commonColumns,
	contentTimestamps,
	databaseTimestamps,
	textEmbeddingColumns,
} from './operations';
import { raindropCollections, raindropTags } from './raindrop';
import { readwiseAuthors } from './readwise';
import { readwiseTags } from './readwise';
import { recordCreators } from './records';
import { recordCategories } from './records';
import { records } from './records';
import { twitterUsers } from './twitter';

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
		mainType: indexMainTypeEnum('main_type').notNull(),
		subType: text('sub_type'),
		name: text('name').notNull(),
		shortName: text('short_name'),
		sense: text('sense'),
		notes: text('notes'),
		canonicalUrl: text('canonical_url'),
		canonicalMediaId: integer('canonical_media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		canonicalMediaUrl: text('canonical_media_url'),
		aliasOf: integer('alias_of').references((): AnyPgColumn => indices.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
		...contentTimestamps,
		...commonColumns,
		...textEmbeddingColumns,
	},
	(table) => [
		unique().on(table.mainType, table.name, table.sense),
		index().on(table.mainType, table.subType),
		index().on(table.canonicalMediaId),
		index().on(table.needsCuration),
	]
);

export const IndicesSelectSchema = createSelectSchema(indices);
export type IndicesSelect = typeof indices.$inferSelect;
export const IndicesInsertSchema = createInsertSchema(indices).extend({
	canonicalUrl: z.string().url().nullable().optional(),
	canonicalMediaUrl: z.string().url().nullable().optional(),
});
export type IndicesInsert = typeof indices.$inferInsert;

export const indexEntriesRelations = relations(indices, ({ one, many }) => ({
	canonicalMedia: one(media, {
		fields: [indices.canonicalMediaId],
		references: [media.id],
	}),
	alias: one(indices, {
		fields: [indices.aliasOf],
		references: [indices.id],
		relationName: 'alias',
	}),
	aliases: many(indices, {
		relationName: 'alias',
	}),
	outgoingRelations: many(indexRelations, {
		relationName: 'source',
	}),
	incomingRelations: many(indexRelations, {
		relationName: 'target',
	}),
	recordsByCreator: many(recordCreators),
	recordsInCategory: many(recordCategories),
	recordsWithFormat: many(records, {
		relationName: 'format',
	}),
	airtableCreators: many(airtableCreators, {
		relationName: 'indexEntry',
	}),
	airtableFormats: many(airtableFormats, {
		relationName: 'indexEntry',
	}),
	airtableSpaces: many(airtableSpaces, {
		relationName: 'indexEntry',
	}),
	githubUsers: many(githubUsers, {
		relationName: 'indexEntry',
	}),
	raindropTags: many(raindropTags, {
		relationName: 'indexEntry',
	}),
	raindropCollections: many(raindropCollections, {
		relationName: 'indexEntry',
	}),
	readwiseAuthors: many(readwiseAuthors, {
		relationName: 'indexEntry',
	}),
	readwiseTags: many(readwiseTags, {
		relationName: 'indexEntry',
	}),
	twitterUsers: many(twitterUsers, {
		relationName: 'indexEntry',
	}),
}));

export const indexRelations = pgTable(
	'index_relations',
	{
		id: serial('id').primaryKey(),
		type: indexRelationTypeEnum('type').notNull().default('related_to'),
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
		...databaseTimestamps,
	},
	(table) => [unique().on(table.sourceId, table.targetId, table.type)]
);

export const IndexRelationSelectSchema = createSelectSchema(indexRelations);
export type IndexRelationSelect = typeof indexRelations.$inferSelect;
export const IndexRelationInsertSchema = createInsertSchema(indexRelations);
export type IndexRelationInsert = typeof indexRelations.$inferInsert;

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
