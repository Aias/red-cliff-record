import {
	pgTable,
	serial,
	text,
	date,
	time,
	timestamp,
	integer,
	pgEnum,
	foreignKey,
	json,
	unique,
	boolean,
	index,
} from 'drizzle-orm/pg-core';
import { relations, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { databaseTimestamps } from '../common';
import { IntegrationType, integrationTypeEnum } from '../operations';
import {
	CategorizationType,
	CreatorRoleType,
	Flag,
	IndexMainType,
	IndexRelationType,
	MediaFormat,
	RecordRelationType,
	RecordType,
	TimepointType,
	type LinkMetadata,
} from './types';

/* ==============================
   TIMEPOINTS AND EVENTS
   ============================== */

// Drizzle enums
export const timepointTypeEnum = pgEnum('timepoint_type', TimepointType.options);

// Tables
export const timepoints = pgTable(
	'timepoints',
	{
		id: serial('id').primaryKey(),
		startDate: date('start_date').notNull(),
		startTime: time('start_time'),
		startInstant: timestamp('start_instant', { withTimezone: true }).notNull(),
		startGranularity: timepointTypeEnum('start_granularity').notNull(),
		endDate: date('end_date'),
		endTime: time('end_time'),
		endInstant: timestamp('end_instant', { withTimezone: true }),
		endGranularity: timepointTypeEnum('end_granularity'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.startDate),
		index().on(table.startInstant),
		index().on(table.startGranularity),
		index().on(table.endDate),
		index().on(table.endInstant),
		index().on(table.endGranularity),
	]
);

// Junction table for record-timepoint relationships
export const recordTimepoints = pgTable(
	'record_timepoints',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		timepointId: integer('timepoint_id')
			.references(() => timepoints.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		label: text('label'),
		order: text('order').notNull().default('a0'),
		...databaseTimestamps,
	},
	(table) => [index().on(table.recordId), index().on(table.timepointId)]
);

// Relations
export const timepointsRelations = relations(timepoints, ({ many }) => ({
	timepoints: many(recordTimepoints),
}));

/* ==============================
   LOCATIONS
   ============================== */

export const locations = pgTable(
	'locations',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		locationType: text('location_type').notNull().default('Place'),
		description: text('description'),
		sourcePlatform: text('source_platform'),
		sourceData: json('source_data'),
		mapPageId: integer('map_page_id').references(() => sources.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		mapImageId: integer('map_image_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		address: text('address'),
		timezone: text('timezone'),
		population: integer('population'),
		elevation: integer('elevation'),
		parentLocationId: integer('parent_location_id'),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.mapPageId),
		index().on(table.mapImageId),
		// Index for type lookups
		index().on(table.locationType),
		// Parent-child lookups
		index().on(table.parentLocationId),
		// Self-referential foreign key
		foreignKey({
			columns: [table.parentLocationId],
			foreignColumns: [table.id],
		}),
		unique().on(table.name, table.locationType, table.parentLocationId),
	]
);

// Relations
export const locationRelations = relations(locations, ({ one, many }) => ({
	mapPage: one(sources, {
		fields: [locations.mapPageId],
		references: [sources.id],
	}),
	mapImage: one(media, {
		fields: [locations.mapImageId],
		references: [media.id],
	}),
	parent: one(locations, {
		fields: [locations.parentLocationId],
		references: [locations.id],
		relationName: 'parentChild',
	}),
	children: many(locations, {
		relationName: 'parentChild',
	}),
}));

/* ==============================
   SOURCES, CONTENT, & MEDIA
   ============================== */

// Main pages table
export const sources = pgTable(
	'sources',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull().unique(),
		domain: text('domain').generatedAlwaysAs(
			(): SQL => sql`LOWER(regexp_replace(${sources.url}, '^https?://([^/]+).*$', '\\1'))`
		),
		title: text('title'),
		origin: integrationTypeEnum('origin').notNull().default(IntegrationType.enum.manual),
		shouldCrawl: boolean('should_crawl').notNull().default(true),
		lastCrawlDate: timestamp('last_crawl_date', { withTimezone: true }),
		lastSuccessfulCrawlDate: timestamp('last_successful_crawl_date', { withTimezone: true }),
		lastHttpStatus: integer('last_http_status'),
		...databaseTimestamps,
	},
	(table) => [index().on(table.domain), index().on(table.lastCrawlDate, table.lastHttpStatus)]
);

// Full-text source contents
export const sourceContents = pgTable(
	'source_contents',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		contentHtml: text('content_html').notNull(),
		contentMarkdown: text('content_markdown'),
		metadata: json('metadata'), // headers, meta tags, etc
		...databaseTimestamps,
	},
	(table) => [index().on(table.sourceId)]
);

// Relationship table for source connections
export const sourceConnections = pgTable(
	'source_connections',
	{
		id: serial('id').primaryKey(),
		fromSourceId: integer('from_source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		toSourceId: integer('to_source_id')
			.references(() => sources.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		metadata: json('metadata').$type<LinkMetadata>(),
		...databaseTimestamps,
	},
	(table) => [
		unique().on(table.fromSourceId, table.toSourceId),
		index().on(table.fromSourceId),
		index().on(table.toSourceId),
	]
);

export const mediaFormatEnum = pgEnum('media_format', MediaFormat.options);

export const media = pgTable(
	'media',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull().unique(),
		format: mediaFormatEnum('format').notNull(),
		mimeType: text('mime_type').notNull(),
		title: text('title'),
		altText: text('alt_text'),
		fileSize: integer('file_size'),
		width: integer('width'),
		height: integer('height'),
		versionOfMediaId: integer('version_of_media_id'),
		sourcePageId: integer('source_page_id').references(() => sources.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		metadata: json('metadata'),
		...databaseTimestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.versionOfMediaId],
			foreignColumns: [table.id],
		}),
		index().on(table.format),
		index().on(table.mimeType),
		index().on(table.sourcePageId),
		index().on(table.versionOfMediaId),
	]
);

// Relations
export const sourceRelations = relations(sources, ({ many }) => ({
	contents: many(sourceContents),
	outgoingLinks: many(sourceConnections, { relationName: 'from' }),
	incomingLinks: many(sourceConnections, { relationName: 'to' }),
	media: many(media, { relationName: 'sourceMedia' }),
}));

export const sourceContentsRelations = relations(sourceContents, ({ one }) => ({
	source: one(sources, {
		fields: [sourceContents.sourceId],
		references: [sources.id],
	}),
}));

export const sourceLinksRelations = relations(sourceConnections, ({ one }) => ({
	from: one(sources, {
		fields: [sourceConnections.fromSourceId],
		references: [sources.id],
		relationName: 'from',
	}),
	to: one(sources, {
		fields: [sourceConnections.toSourceId],
		references: [sources.id],
		relationName: 'to',
	}),
}));

export const mediaRelations = relations(media, ({ one, many }) => ({
	source: one(sources, {
		fields: [media.sourcePageId],
		references: [sources.id],
		relationName: 'sourceMedia',
	}),
	versionOf: one(media, {
		fields: [media.versionOfMediaId],
		references: [media.id],
		relationName: 'versionOf',
	}),
	versions: many(media, {
		relationName: 'versionOf',
	}),
}));

/* ==============================
   INDEX
   ============================== */

export const indexMainTypeEnum = pgEnum('index_main_type', IndexMainType.options);
export const indexRelationTypeEnum = pgEnum('index_relation_type', IndexRelationType.options);

// Main index table
export const indexEntries = pgTable(
	'index_entries',
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

// See-also relationships
export const indexRelations = pgTable(
	'index_relations',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => indexEntries.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		targetId: integer('target_id')
			.references(() => indexEntries.id, {
				onDelete: 'cascade',
				onUpdate: 'cascade',
			})
			.notNull(),
		type: indexRelationTypeEnum('type').notNull().default('related_to'),
		...databaseTimestamps,
	},
	(table) => [unique().on(table.sourceId, table.targetId, table.type)]
);

// Relations
export const indexEntriesRelations = relations(indexEntries, ({ one, many }) => ({
	canonicalPage: one(sources, {
		fields: [indexEntries.canonicalPageId],
		references: [sources.id],
	}),
	canonicalMedia: one(media, {
		fields: [indexEntries.canonicalMediaId],
		references: [media.id],
	}),
	alias: one(indexEntries, {
		fields: [indexEntries.aliasOf],
		references: [indexEntries.id],
		relationName: 'aliasRelation',
	}),
	aliases: many(indexEntries, {
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
	source: one(indexEntries, {
		fields: [indexRelations.sourceId],
		references: [indexEntries.id],
		relationName: 'source',
	}),
	target: one(indexEntries, {
		fields: [indexRelations.targetId],
		references: [indexEntries.id],
		relationName: 'target',
	}),
}));

export const IndexEntrySelectSchema = createSelectSchema(indexEntries);
export type IndexEntrySelect = z.infer<typeof IndexEntrySelectSchema>;
export const IndexEntryInsertSchema = createInsertSchema(indexEntries);
export type IndexEntryInsert = z.infer<typeof IndexEntryInsertSchema>;
export const IndexEntryUpdateSchema = createUpdateSchema(indexEntries);
export type IndexEntryUpdate = z.infer<typeof IndexEntryUpdateSchema>;

export const IndexRelationSelectSchema = createSelectSchema(indexRelations);
export type IndexRelationSelect = z.infer<typeof IndexRelationSelectSchema>;
export const IndexRelationInsertSchema = createInsertSchema(indexRelations);
export type IndexRelationInsert = z.infer<typeof IndexRelationInsertSchema>;
export const IndexRelationUpdateSchema = createUpdateSchema(indexRelations);
export type IndexRelationUpdate = z.infer<typeof IndexRelationUpdateSchema>;

/* ==============================
   RECORDS
   ============================== */

// Enums
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
		formatId: integer('format_id').references(() => indexEntries.id, {
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
		...databaseTimestamps,
	},
	(table) => [index().on(table.type), index().on(table.formatId), index().on(table.locationId)]
);

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
			.references(() => indexEntries.id, {
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
			.references(() => indexEntries.id, {
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
	category: one(indexEntries, {
		fields: [recordCategories.categoryId],
		references: [indexEntries.id],
	}),
}));

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

// Relations
export const recordsRelations = relations(records, ({ one, many }) => ({
	format: one(indexEntries, {
		fields: [records.formatId],
		references: [indexEntries.id],
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
	entity: one(indexEntries, {
		fields: [recordCreators.entityId],
		references: [indexEntries.id],
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
