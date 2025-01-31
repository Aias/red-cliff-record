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
	vector,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { databaseTimestamps } from '../common';
import { indices } from './indices';
import { locations } from './locations';
import { media } from './media';
import { sources } from './sources';
import { recordTimepoints, timepoints } from './timepoints';

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

export const RecordType = z.enum([
	'resource', // reference material, tools, techniques
	'bookmark', // interesting but not reference material
	'object', // physical or digital object
	'document', // text-heavy content
	'abstraction', // concept or idea
	'extracted', // quote or excerpt
	'event', // point in time or occurrence of an event
]);
export type RecordType = z.infer<typeof RecordType>;

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
	'primary_source',
	'quoted_from',
	'copied_from',
	'derived_from',
	'part_of',
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

export const recordTypeEnum = pgEnum('record_type', RecordType.options);
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
		content: text('content'),
		type: recordTypeEnum('type').notNull(),
		formatId: integer('format_id').references(() => indices.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		private: boolean('private').notNull().default(false),
		flags: flagEnum('flags').array(),
		needsCuration: boolean('needs_curation').notNull().default(true),
		locationId: integer('location_id').references(() => locations.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		url: text('url'),
		embedding: vector('embedding', { dimensions: 768 }),
		...databaseTimestamps,
	},
	(table) => [index().on(table.type), index().on(table.formatId), index().on(table.locationId)]
);

export const RecordSelectSchema = createSelectSchema(records);
export type RecordSelect = z.infer<typeof RecordSelectSchema>;
export const RecordInsertSchema = createInsertSchema(records).extend({
	url: z.string().url().optional().nullable(),
});
export type RecordInsert = z.infer<typeof RecordInsertSchema>;
export const RecordUpdateSchema = createUpdateSchema(records).extend({
	url: z.string().url().optional().nullable(),
});
export type RecordUpdate = z.infer<typeof RecordUpdateSchema>;

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
export type RecordRelationSelect = z.infer<typeof RecordRelationSelectSchema>;
export const RecordRelationInsertSchema = createInsertSchema(recordRelations);
export type RecordRelationInsert = z.infer<typeof RecordRelationInsertSchema>;
export const RecordRelationUpdateSchema = createUpdateSchema(recordRelations);
export type RecordRelationUpdate = z.infer<typeof RecordRelationUpdateSchema>;

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
export type RecordCreatorSelect = z.infer<typeof RecordCreatorSelectSchema>;
export const RecordCreatorInsertSchema = createInsertSchema(recordCreators);
export type RecordCreatorInsert = z.infer<typeof RecordCreatorInsertSchema>;
export const RecordCreatorUpdateSchema = createUpdateSchema(recordCreators);
export type RecordCreatorUpdate = z.infer<typeof RecordCreatorUpdateSchema>;

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
export type RecordCategorySelect = z.infer<typeof RecordCategorySelectSchema>;
export const RecordCategoryInsertSchema = createInsertSchema(recordCategories);
export type RecordCategoryInsert = z.infer<typeof RecordCategoryInsertSchema>;
export const RecordCategoryUpdateSchema = createUpdateSchema(recordCategories);
export type RecordCategoryUpdate = z.infer<typeof RecordCategoryUpdateSchema>;

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
export type RecordMediaSelect = z.infer<typeof RecordMediaSelectSchema>;
export const RecordMediaInsertSchema = createInsertSchema(recordMedia);
export type RecordMediaInsert = z.infer<typeof RecordMediaInsertSchema>;
export const RecordMediaUpdateSchema = createUpdateSchema(recordMedia);
export type RecordMediaUpdate = z.infer<typeof RecordMediaUpdateSchema>;

// Page links
export const recordSources = pgTable(
	'record_sources',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		sourceId: integer('source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		order: text('order').notNull().default('a0'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.recordId),
		index().on(table.sourceId),
		unique().on(table.recordId, table.sourceId),
	]
);

export const RecordSourceSelectSchema = createSelectSchema(recordSources);
export type RecordSourceSelect = z.infer<typeof RecordSourceSelectSchema>;
export const RecordSourceInsertSchema = createInsertSchema(recordSources);
export type RecordSourceInsert = z.infer<typeof RecordSourceInsertSchema>;
export const RecordSourceUpdateSchema = createUpdateSchema(recordSources);
export type RecordSourceUpdate = z.infer<typeof RecordSourceUpdateSchema>;

// Relations
export const recordsRelations = relations(records, ({ one, many }) => ({
	format: one(indices, {
		fields: [records.formatId],
		references: [indices.id],
	}),
	location: one(locations, {
		fields: [records.locationId],
		references: [locations.id],
	}),
	timepoints: many(recordTimepoints),
	creators: many(recordCreators),
	categories: many(recordCategories),
	media: many(recordMedia),
	sources: many(recordSources),
	outgoingRelations: many(recordRelations, { relationName: 'source' }),
	incomingRelations: many(recordRelations, { relationName: 'target' }),
}));

export const recordTimepointsRelations = relations(recordTimepoints, ({ one }) => ({
	record: one(records, {
		fields: [recordTimepoints.recordId],
		references: [records.id],
	}),
	timepoint: one(timepoints, {
		fields: [recordTimepoints.timepointId],
		references: [timepoints.id],
	}),
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

export const recordPagesRelations = relations(recordSources, ({ one }) => ({
	record: one(records, {
		fields: [recordSources.recordId],
		references: [records.id],
	}),
	page: one(sources, {
		fields: [recordSources.sourceId],
		references: [sources.id],
	}),
}));
