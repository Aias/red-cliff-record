import {
	pgTable,
	serial,
	varchar,
	date,
	time,
	timestamp,
	integer,
	pgEnum,
	foreignKey,
	json,
	unique,
	boolean,
	text,
	index,
	geometry,
	customType,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { timestamps } from './common';

/* ==============================
   TIMEPOINTS AND EVENTS
   ============================== */

// Zod enums
export const TimepointType = z.enum([
	'instant',
	'second',
	'minute',
	'hour',
	'day',
	'week',
	'month',
	'quarter',
	'year',
	'custom',
]);
export type TimepointType = z.infer<typeof TimepointType>;

export const EventType = z.enum([
	'project',
	'milestone',
	'holiday',
	'meeting',
	'deadline',
	'reminder',
	'recurring',
	'event',
]);
export type EventType = z.infer<typeof EventType>;

export const CertaintyType = z.enum(['fixed', 'estimated', 'target', 'tentative', 'milestone']);
export type CertaintyType = z.infer<typeof CertaintyType>;

// Drizzle enums
export const timepointTypeEnum = pgEnum('timepoint_type', TimepointType.options);

export const eventTypeEnum = pgEnum('event_type', EventType.options);

export const certaintyTypeEnum = pgEnum('certainty_type', CertaintyType.options);

// Tables
export const timepoints = pgTable('timepoints', {
	id: serial('id').primaryKey(),
	type: timepointTypeEnum('type').notNull(),
	startDate: date('start_date').notNull(),
	startTime: time('start_time').notNull(),
	startInstant: timestamp('start_instant', { withTimezone: true }).notNull(),
	endDate: date('end_date').notNull(),
	endTime: time('end_time').notNull(),
	endInstant: timestamp('end_instant', { withTimezone: true }).notNull(),
});

export const events = pgTable(
	'events',
	{
		id: serial('id').primaryKey(),
		name: varchar('name').notNull(),
		type: eventTypeEnum('type').notNull().default(EventType.enum.event),
		timepoint: integer('timepoint')
			.references(() => timepoints.id)
			.notNull(),
		timepointCertainty: certaintyTypeEnum('timepoint_certainty')
			.notNull()
			.default(CertaintyType.enum.fixed),
		secondaryTimepoint: integer('secondary_timepoint').references(() => timepoints.id),
		secondaryTimepointCertainty: certaintyTypeEnum('secondary_timepoint_certainty'),
		parentEventId: integer('parent_event_id'),
		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.parentEventId],
			foreignColumns: [table.id],
		}),
		index('event_type_idx').on(table.type),
		index('event_timepoint_idx').on(table.timepoint),
		index('event_parent_idx').on(table.parentEventId),
	]
);

// Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
	primaryTimepoint: one(timepoints, {
		fields: [events.timepoint],
		references: [timepoints.id],
		relationName: 'primaryTimepoint',
	}),
	secondaryTimepoint: one(timepoints, {
		fields: [events.secondaryTimepoint],
		references: [timepoints.id],
		relationName: 'secondaryTimepoint',
	}),
	parent: one(events, {
		fields: [events.parentEventId],
		references: [events.id],
		relationName: 'parentChild',
	}),
	children: many(events, {
		relationName: 'parentChild',
	}),
}));

export const timepointsRelations = relations(timepoints, ({ many }) => ({
	primaryEvents: many(events, {
		relationName: 'primaryTimepoint',
	}),
	secondaryEvents: many(events, {
		relationName: 'secondaryTimepoint',
	}),
}));

// You can also export the full table types
export type Timepoint = typeof timepoints.$inferSelect;
export type NewTimepoint = typeof timepoints.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

/* ==============================
   URLS
   ============================== */

// Enum for reference types
export const URLType = z.enum([
	'primary', // primary/starting points
	'crawled', // discovered through crawling
]);
export type URLType = z.infer<typeof URLType>;
export const urlTypeEnum = pgEnum('url_type', URLType.options);

// Main web references table
export const urls = pgTable(
	'urls',
	{
		id: serial('id').primaryKey(),
		url: varchar('url').notNull(),
		title: varchar('title'),
		type: urlTypeEnum('type').notNull().default(URLType.enum.primary),
		lastCrawlDate: timestamp('last_crawl_date', { withTimezone: true }),
		lastHttpStatus: integer('last_http_status'),
		contentType: varchar('content_type'),
		isInternal: boolean('is_internal').notNull().default(false),
		...timestamps,
	},
	(table) => [
		unique('url_idx').on(table.url),
		index('crawl_status_idx').on(table.lastCrawlDate, table.lastHttpStatus),
		index('content_type_idx').on(table.contentType),
	]
);

// Metadata schema
export const LinkMetadataSchema = z
	.object({
		linkText: z.string().optional(),
		attributes: z.record(z.string()).optional(),
	})
	.strict();
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

// Relationship table for URL connections
export const urlLinks = pgTable('url_links', {
	id: serial('id').primaryKey(),
	sourceId: integer('source_id')
		.references(() => urls.id)
		.notNull(),
	targetId: integer('target_id')
		.references(() => urls.id)
		.notNull(),
	metadata: json('metadata').$type<LinkMetadata>(),
	...timestamps,
});

// Relations
export const urlRelations = relations(urls, ({ many }) => ({
	outgoingLinks: many(urlLinks, { relationName: 'source' }),
	incomingLinks: many(urlLinks, { relationName: 'target' }),
}));

export const urlLinksRelations = relations(urlLinks, ({ one }) => ({
	source: one(urls, {
		fields: [urlLinks.sourceId],
		references: [urls.id],
		relationName: 'source',
	}),
	target: one(urls, {
		fields: [urlLinks.targetId],
		references: [urls.id],
		relationName: 'target',
	}),
}));

// Type exports
export type Url = typeof urls.$inferSelect;
export type NewUrl = typeof urls.$inferInsert;
export type UrlLink = typeof urlLinks.$inferSelect;
export type NewUrlLink = typeof urlLinks.$inferInsert;

/* ==============================
   INDEX
   ============================== */

export const IndexMainType = z.enum([
	'entity', // who/what created something
	'subject', // what something is about
	'format', // what something is
]);
export type IndexMainType = z.infer<typeof IndexMainType>;

export const IndexRelationType = z.enum(['related_to', 'opposite_of', 'part_of']);
export type IndexRelationType = z.infer<typeof IndexRelationType>;

// Drizzle enums
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
		canonicalUrlId: integer('canonical_url_id').references(() => urls.id),
		aliasOf: integer('alias_of'),
		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.aliasOf],
			foreignColumns: [table.id],
		}),
		unique('index_entry_idx').on(table.name, table.sense, table.mainType),
		index('type_subtype_idx').on(table.mainType, table.subType),
	]
);

// See-also relationships
export const indexRelations = pgTable('index_relations', {
	id: serial('id').primaryKey(),
	sourceId: integer('source_id')
		.references(() => indexEntries.id)
		.notNull(),
	targetId: integer('target_id')
		.references(() => indexEntries.id)
		.notNull(),
	type: indexRelationTypeEnum('type').notNull().default('related_to'),
	...timestamps,
});

// Relations
export const indexEntriesRelations = relations(indexEntries, ({ one, many }) => ({
	canonicalUrl: one(urls, {
		fields: [indexEntries.canonicalUrlId],
		references: [urls.id],
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

// Type exports
export type IndexEntry = typeof indexEntries.$inferSelect;
export type NewIndexEntry = typeof indexEntries.$inferInsert;
export type IndexRelation = typeof indexRelations.$inferSelect;
export type NewIndexRelation = typeof indexRelations.$inferInsert;

/* ==============================
   MEDIA
   ============================== */

// Enums
export const MediaType = z.enum(['image', 'video', 'audio', 'pdf']);
export type MediaType = z.infer<typeof MediaType>;
export const mediaTypeEnum = pgEnum('media_type', MediaType.options);

export const DocumentFormat = z.enum(['html', 'markdown', 'plaintext']);
export type DocumentFormat = z.infer<typeof DocumentFormat>;
export const documentFormatEnum = pgEnum('document_format', DocumentFormat.options);

// Tables
export const media = pgTable(
	'media',
	{
		id: serial('id').primaryKey(),
		type: mediaTypeEnum('type').notNull(),
		urlId: integer('url_id')
			.references(() => urls.id)
			.notNull(),
		title: text('title'),
		altText: text('alt_text'),
		caption: text('caption'),
		metadata: json('metadata'),
		...timestamps,
	},
	(table) => [index('media_type_idx').on(table.type), index('media_url_idx').on(table.urlId)]
);

export const documents = pgTable(
	'documents',
	{
		id: serial('id').primaryKey(),
		urlId: integer('url_id').references(() => urls.id),
		title: text('title').notNull(),
		format: documentFormatEnum('format').notNull(),
		content: text('content').notNull(),
		metadata: json('metadata'),
		...timestamps,
	},
	(table) => [index('document_format_idx').on(table.format)]
);

// Relations
export const mediaRelations = relations(media, ({ one }) => ({
	url: one(urls, {
		fields: [media.urlId],
		references: [urls.id],
	}),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
	url: one(urls, {
		fields: [documents.urlId],
		references: [urls.id],
	}),
}));

// Type exports
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

/* ==============================
   LOCATIONS
   ============================== */

const multipolygon = customType<{ data: string }>({
	dataType() {
		return 'geometry(MultiPolygon, 4326)';
	},
});

export const locations = pgTable(
	'locations',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		locationType: text('location_type').notNull().default('Place'),
		description: text('description'),
		coordinates: geometry('coordinates', { srid: 4326, type: 'point', mode: 'xy' }).notNull(),
		boundingBox: multipolygon('bounding_box'),
		sourceData: json('source_data'),
		mapUrlId: integer('map_url_id').references(() => urls.id),
		address: text('address'),
		timezone: text('timezone'),
		population: integer('population'),
		elevation: integer('elevation'),
		parentLocationId: integer('parent_location_id'),
		...timestamps,
	},
	(table) => [
		// Spatial index on geometry
		index('location_coordinates_idx').using('gist', table.coordinates),
		// Spatial index on bounding box
		index('location_bounding_box_idx').using('gist', table.boundingBox),
		// Index for type lookups
		index('location_type_idx').on(table.locationType),
		// Parent-child lookups
		index('location_parent_idx').on(table.parentLocationId),
		// Self-referential foreign key
		foreignKey({
			columns: [table.parentLocationId],
			foreignColumns: [table.id],
		}),
		unique('location_name_type_parent_idx').on(
			table.name,
			table.locationType,
			table.parentLocationId
		),
	]
);

// Relations
export const locationRelations = relations(locations, ({ one, many }) => ({
	mapUrl: one(urls, {
		fields: [locations.mapUrlId],
		references: [urls.id],
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

// Type exports
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
