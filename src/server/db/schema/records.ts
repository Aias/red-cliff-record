import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	smallint,
	text,
	timestamp,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import {
	contentTimestamps,
	databaseTimestamps,
	integrationTypeEnum,
	textEmbeddingColumns,
} from './operations';
import { emptyStringToNull } from '@/shared/lib/formatting';

export const recordTypeEnum = pgEnum('record_type', [
	'entity', // an actor in the world, has will
	'concept', // a category, idea, or abstraction
	'artifact', // physical or digital objects, content, or media
]);
export const RecordTypeSchema = z.enum(recordTypeEnum.enumValues);
export type RecordType = z.infer<typeof RecordTypeSchema>;

// Main index table
export const records = pgTable(
	'records',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').unique(),
		type: recordTypeEnum('type').notNull().default('artifact'),
		title: text('title'),
		sense: text('sense'),
		abbreviation: text('abbreviation'),
		url: text('url'),
		avatarUrl: text('avatar_url'),
		summary: text('summary'),
		content: text('content'),
		notes: text('notes'),
		mediaCaption: text('media_caption'),
		rating: smallint('rating').notNull().default(0),
		isPrivate: boolean('is_private').notNull().default(false),
		isCurated: boolean('is_curated').notNull().default(false),
		reminderAt: timestamp('reminder_at', { withTimezone: true }),
		sources: integrationTypeEnum('sources').array(),
		...databaseTimestamps,
		...contentTimestamps,
		...textEmbeddingColumns,
	},
	(table) => [
		index().on(table.type, table.title, table.url),
		index().on(table.slug),
		index('idx_records_content_search').using(
			'gin',
			table.title,
			table.abbreviation,
			table.sense,
			table.url,
			table.summary,
			table.content,
			table.notes,
			table.mediaCaption
		),
		index('idx_records_sources').using('gin', table.sources),
		index().on(table.recordCreatedAt),
		index().on(table.recordUpdatedAt),
		index().on(table.rating),
		index().on(table.isPrivate),
		index().on(table.isCurated),
		index().using('hnsw', table.textEmbedding.op('vector_cosine_ops')),
	]
);

export const RecordSelectSchema = createSelectSchema(records);
export type RecordSelect = typeof records.$inferSelect;
export const RecordInsertSchema = createInsertSchema(records).extend({
	url: emptyStringToNull(z.url()).optional(),
	avatarUrl: emptyStringToNull(z.url()).optional(),
	rating: z.number().int().min(0).max(3).default(0),
});
export type RecordInsert = typeof records.$inferInsert;

export const links = pgTable(
	'links',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		targetId: integer('target_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		predicateId: integer('predicate_id')
			.references(() => predicates.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		notes: text('notes'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.sourceId, table.predicateId),
		index().on(table.targetId, table.predicateId),
		index().on(table.sourceId),
		index().on(table.targetId),
		index().on(table.predicateId),
		unique().on(table.sourceId, table.targetId, table.predicateId),
	]
);

export const LinkSelectSchema = createSelectSchema(links);
export type LinkSelect = typeof links.$inferSelect;
export const LinkInsertSchema = createInsertSchema(links);
export type LinkInsert = typeof links.$inferInsert;

export const predicateTypeEnum = pgEnum('predicate_type', [
	'creation', // authorship, ownership …
	'containment', // has_part, sequence …
	'description', // about, tag …
	'association', // related_to, similar_to …
	'reference', // cites, responds_to …
	'identity', // instance_of, same_as …
]);
export const PredicateType = z.enum(predicateTypeEnum.enumValues);
export type PredicateType = z.infer<typeof PredicateType>;

export const predicates = pgTable(
	'predicates',
	{
		id: serial('id').primaryKey(),
		slug: text('slug').unique().notNull(),
		name: text('name').notNull(),
		type: predicateTypeEnum('type').notNull(),
		role: text('role'),
		inverseSlug: text('inverse_slug').references((): AnyPgColumn => predicates.slug, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		canonical: boolean('canonical').notNull().default(true),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.id, table.type),
		index().on(table.slug),
		index().on(table.type),
		index().on(table.role),
		index().on(table.canonical),
		index().on(table.inverseSlug),
		index().on(table.type, table.canonical),
	]
);

export const PredicateSelectSchema = createSelectSchema(predicates);
export type PredicateSelect = typeof predicates.$inferSelect;
export const PredicateInsertSchema = createInsertSchema(predicates);
export type PredicateInsert = typeof predicates.$inferInsert;
