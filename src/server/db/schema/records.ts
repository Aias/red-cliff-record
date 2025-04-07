import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import {
	contentTimestamps,
	databaseTimestamps,
	integrationTypeEnum,
	textEmbeddingColumns,
} from './operations';
import { emptyStringToNull } from '@/lib/formatting';
import { DEFAULT_ORDER_KEY } from '@/lib/lexicography';

export const RecordTypeSchema = z.enum([
	'entity', // an actor in the world, has will
	'concept', // a category, idea, or abstraction
	'artifact', // physical or digital objects, content, or media
	'event', // an event or occurrence
	'place', // a geographic location
	'system', // a physical or conceptual system or network
]);
export type RecordType = z.infer<typeof RecordTypeSchema>;
export const recordTypeEnum = pgEnum('record_type', RecordTypeSchema.options);

export const ChildTypeSchema = z.enum([
	'part_of', // default parent-child relationship
	'quotes', // quotes parent record, as a quote tweet
]);
export type ChildType = z.infer<typeof ChildTypeSchema>;
export const childTypeEnum = pgEnum('child_type', ChildTypeSchema.options);

// Main index table
export const records = pgTable(
	'records',
	{
		id: serial('id').primaryKey(),
		type: recordTypeEnum('type').notNull(),
		title: text('title'),
		sense: text('sense'),
		abbreviation: text('abbreviation'),
		url: text('url'),
		avatarUrl: text('avatar_url'),
		summary: text('summary'),
		content: text('content'),
		notes: text('notes'),
		mediaCaption: text('media_caption'),
		formatId: integer('format_id').references((): AnyPgColumn => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		parentId: integer('parent_id').references((): AnyPgColumn => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		childOrder: text('child_order').notNull().default(DEFAULT_ORDER_KEY),
		childType: childTypeEnum('child_type'),
		transcludeId: integer('transclude_id').references((): AnyPgColumn => records.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		rating: integer('rating').notNull().default(0),
		isIndexNode: boolean('is_index_node').notNull().default(false),
		isFormat: boolean('is_format').notNull().default(false),
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
		index().on(table.parentId),
		index().on(table.formatId),
		index().on(table.transcludeId),
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
		index().on(table.rating),
		index().on(table.isIndexNode),
		index().on(table.isFormat),
		index().on(table.isPrivate),
		index().on(table.isCurated),
		index().using('hnsw', table.textEmbedding.op('vector_cosine_ops')),
	]
);

export const RecordSelectSchema = createSelectSchema(records);
export type RecordSelect = typeof records.$inferSelect;
export const RecordInsertSchema = createInsertSchema(records).extend({
	url: emptyStringToNull(z.string().url()).optional(),
	avatarUrl: emptyStringToNull(z.string().url()).optional(),
	rating: z.number().int().min(0).max(3).default(0),
});
export type RecordInsert = typeof records.$inferInsert;

// Non-hierarchical relationships
export const RecordRelationType = z.enum([
	'tagged', // tagged with this thing
	'related_to', // related to this thing
	'about', // about this thing (at a meta-level)
	'example_of', // an example of this thing
	'references', // references this thing
	'responds_to', // responds to this thing
	'contradicts', // contradicts this thing
	'supports', // supports this thing
]);
export type RecordRelationType = z.infer<typeof RecordRelationType>;
export const recordRelationTypeEnum = pgEnum('record_relation_type', RecordRelationType.options);

export const recordRelations = pgTable(
	'record_relations',
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
		type: recordRelationTypeEnum('type').notNull(),
		order: text('order').notNull().default(DEFAULT_ORDER_KEY),
		notes: text('notes'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.sourceId),
		index().on(table.targetId),
		unique().on(table.sourceId, table.targetId, table.type),
	]
);

export const RecordRelationSelectSchema = createSelectSchema(recordRelations);
export type RecordRelationSelect = typeof recordRelations.$inferSelect;
export const RecordRelationInsertSchema = createInsertSchema(recordRelations);
export type RecordRelationInsert = typeof recordRelations.$inferInsert;

export const CreatorRoleSchema = z.enum([
	'creator', // primary creator
	'owner', // owner of the record
	'author', // specifically wrote/authored
	'editor', // edited/curated
	'contributor', // helped create/contributed to
	'via', // found through/attributed to
	'participant', // involved in
	'interviewer', // conducted interview
	'interviewee', // was interviewed
	'subject', // topic is about this person
	'mentioned', // referenced in content
]);
export type CreatorRole = z.infer<typeof CreatorRoleSchema>;
export const creatorRoleEnum = pgEnum('creator_role', CreatorRoleSchema.options);

// Creator relationships
export const recordCreators = pgTable(
	'record_creators',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		creatorId: integer('creator_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		creatorRole: creatorRoleEnum('creator_role').notNull().default('creator'),
		order: text('order').notNull().default(DEFAULT_ORDER_KEY),
		notes: text('notes'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.recordId),
		index().on(table.creatorId),
		unique().on(table.recordId, table.creatorId, table.creatorRole),
	]
);

export const RecordCreatorSelectSchema = createSelectSchema(recordCreators);
export type RecordCreatorSelect = typeof recordCreators.$inferSelect;
export const RecordCreatorInsertSchema = createInsertSchema(recordCreators);
export type RecordCreatorInsert = typeof recordCreators.$inferInsert;
