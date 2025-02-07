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
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { indices } from './indices';
import { media } from './media';
import {
	commonColumns,
	contentTimestamps,
	databaseTimestamps,
	textEmbeddingColumns,
} from './operations';

export const FLAGS = {
	important: {
		name: 'Important',
		emoji: '⭐',
		description: 'Important content',
	},
	favorite: {
		name: 'Favorite',
		emoji: '💖',
		description: 'Favorite content',
	},
	draft: {
		name: 'Draft',
		emoji: '📝',
		description: 'Work in progress',
	},
	follow_up: {
		name: 'Follow-up',
		emoji: '🚩',
		description: 'Needs further action',
	},
	review: {
		name: 'Review',
		emoji: '⏲️',
		description: 'Marked for later review',
	},
	outdated: {
		name: 'Outdated',
		emoji: '📅',
		description: 'Content needs updating',
	},
} as const;

export const Flag = z.enum(
	Object.keys(FLAGS) as [keyof typeof FLAGS, ...Array<keyof typeof FLAGS>]
);
export type Flag = z.infer<typeof Flag>;

// Type safety
export type FlagData = typeof FLAGS;
export type FlagKey = keyof FlagData;

export const CreatorRoleType = z.enum([
	'creator', // primary creator
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
export type CreatorRoleType = z.infer<typeof CreatorRoleType>;

export const RecordRelationType = z.enum([
	// Hierarchical
	'part_of',
	'primary_source',
	'quoted_from',
	'copied_from',
	'derived_from',
	// Non-hierarchical
	'references',
	'similar_to',
	'responds_to',
	'contradicts',
	'supports',
]);
export type RecordRelationType = z.infer<typeof RecordRelationType>;

export const CategorizationType = z.enum([
	'about', // meta-level subject matter
	'file_under', // organizational category
]);
export type CategorizationType = z.infer<typeof CategorizationType>;

export const creatorRoleTypeEnum = pgEnum('creator_role_type', CreatorRoleType.options);
export const recordRelationTypeEnum = pgEnum('record_relation_type', RecordRelationType.options);
export const categorizationTypeEnum = pgEnum('categorization_type', CategorizationType.options);
export const flagEnum = pgEnum('flag', Flag.options);

// Main records table
export const records = pgTable(
	'records',
	{
		id: serial('id').primaryKey(),
		title: text('title'),
		url: text('url'),
		content: text('content'),
		summary: text('summary'),
		notes: text('notes'),
		mediaCaption: text('media_caption'),
		flags: flagEnum('flags').array(),
		formatId: integer('format_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
		...contentTimestamps,
		...commonColumns,
		...textEmbeddingColumns,
	},
	(table) => [index().on(table.title), index().on(table.url), index().on(table.formatId)]
);

export const RecordSelectSchema = createSelectSchema(records);
export type RecordSelect = typeof records.$inferSelect;
export const RecordInsertSchema = createInsertSchema(records).extend({
	url: z.string().url().optional().nullable(),
});
export type RecordInsert = typeof records.$inferInsert;

// Combined hierarchy/relations table
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
		order: text('order').notNull().default('a0'),
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
		entityId: integer('entity_id')
			.references(() => indices.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		role: creatorRoleTypeEnum('role').notNull(),
		order: text('order').notNull().default('a0'),
		notes: text('notes'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.recordId),
		index().on(table.entityId),
		unique().on(table.recordId, table.entityId, table.role),
	]
);

export const RecordCreatorSelectSchema = createSelectSchema(recordCreators);
export type RecordCreatorSelect = typeof recordCreators.$inferSelect;
export const RecordCreatorInsertSchema = createInsertSchema(recordCreators);
export type RecordCreatorInsert = typeof recordCreators.$inferInsert;

// Categorization
export const recordCategories = pgTable(
	'record_categories',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		categoryId: integer('category_id')
			.references(() => indices.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		type: categorizationTypeEnum('type').notNull(),
		primary: boolean('primary').notNull().default(false),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.recordId),
		index().on(table.categoryId),
		unique().on(table.recordId, table.categoryId, table.type),
	]
);

export const recordCategoriesRelations = relations(recordCategories, ({ one }) => ({
	record: one(records, {
		fields: [recordCategories.recordId],
		references: [records.id],
	}),
	category: one(indices, {
		fields: [recordCategories.categoryId],
		references: [indices.id],
	}),
}));

export const RecordCategorySelectSchema = createSelectSchema(recordCategories);
export type RecordCategorySelect = typeof recordCategories.$inferSelect;
export const RecordCategoryInsertSchema = createInsertSchema(recordCategories);
export type RecordCategoryInsert = typeof recordCategories.$inferInsert;

// Media links with captions
export const recordMedia = pgTable(
	'record_media',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		mediaId: integer('media_id')
			.references(() => media.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		caption: text('caption'),
		order: text('order').notNull().default('a0'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.recordId),
		index().on(table.mediaId),
		unique().on(table.recordId, table.mediaId),
	]
);

export const RecordMediaSelectSchema = createSelectSchema(recordMedia);
export type RecordMediaSelect = typeof recordMedia.$inferSelect;
export const RecordMediaInsertSchema = createInsertSchema(recordMedia);
export type RecordMediaInsert = typeof recordMedia.$inferInsert;

// Relations
export const recordsRelations = relations(records, ({ one, many }) => ({
	format: one(indices, {
		fields: [records.formatId],
		references: [indices.id],
	}),

	recordCreators: many(recordCreators),
	recordCategories: many(recordCategories),
	recordMedia: many(recordMedia),
	recordOutgoingRelations: many(recordRelations, { relationName: 'source' }),
	recordIncomingRelations: many(recordRelations, { relationName: 'target' }),
}));

export const recordCreatorsRelations = relations(recordCreators, ({ one }) => ({
	record: one(records, {
		fields: [recordCreators.recordId],
		references: [records.id],
	}),
	creator: one(indices, {
		fields: [recordCreators.entityId],
		references: [indices.id],
	}),
}));

export const recordRelationsRelations = relations(recordRelations, ({ one }) => ({
	source: one(records, {
		fields: [recordRelations.sourceId],
		references: [records.id],
		relationName: 'source',
	}),
	target: one(records, {
		fields: [recordRelations.targetId],
		references: [records.id],
		relationName: 'target',
	}),
}));

export const recordMediaRelations = relations(recordMedia, ({ one }) => ({
	record: one(records, {
		fields: [recordMedia.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [recordMedia.mediaId],
		references: [media.id],
	}),
}));
