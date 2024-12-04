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
	geometry,
	customType,
	type PgDatabase,
} from 'drizzle-orm/pg-core';
import { relations, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import mime from 'mime-types';
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
		name: text('name').notNull(),
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

// Type exports
export type Timepoint = typeof timepoints.$inferSelect;
export type NewTimepoint = typeof timepoints.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

/* ==============================
   PAGES, LINKS, CONTENT, & MEDIA
   ============================== */

export const PageType = z.enum([
	'primary', // primary/starting points
	'crawled', // discovered through crawling
]);
export type PageType = z.infer<typeof PageType>;
export const pageTypeEnum = pgEnum('page_type', PageType.options);

// Main pages table
export const pages = pgTable(
	'pages',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull(),
		domain: text('domain').generatedAlwaysAs(
			(): SQL => sql`LOWER(regexp_replace(${pages.url}, '^https?://([^/]+).*$', '\\1'))`
		),
		title: text('title'),
		type: pageTypeEnum('type').notNull().default(PageType.enum.primary),
		lastCrawlDate: timestamp('last_crawl_date', { withTimezone: true }),
		lastSuccessfulCrawlDate: timestamp('last_successful_crawl_date', { withTimezone: true }),
		lastHttpStatus: integer('last_http_status'),
		isInternal: boolean('is_internal').notNull().default(false),
		metadata: json('metadata'), // headers, meta tags, etc
		...timestamps,
	},
	(table) => [
		unique('page_url_idx').on(table.url),
		index('page_domain_idx').on(table.domain),
		index('crawl_status_idx').on(table.lastCrawlDate, table.lastHttpStatus),
	]
);

// Page content versions
export const pageContents = pgTable(
	'page_contents',
	{
		id: serial('id').primaryKey(),
		pageId: integer('page_id')
			.references(() => pages.id)
			.notNull(),
		contentHtml: text('content_html').notNull(),
		contentMarkdown: text('content_markdown'),
		crawlDate: timestamp('crawl_date', { withTimezone: true }).notNull(),
		...timestamps,
	},
	(table) => [index('page_content_idx').on(table.pageId, table.crawlDate)]
);

// Link metadata schema
export const LinkMetadataSchema = z
	.object({
		linkText: z.string().optional(),
		attributes: z.record(z.string()).optional(),
	})
	.strict();
export type LinkMetadata = z.infer<typeof LinkMetadataSchema>;

// Relationship table for page connections
export const pageLinks = pgTable(
	'page_links',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => pages.id)
			.notNull(),
		targetId: integer('target_id')
			.references(() => pages.id)
			.notNull(),
		metadata: json('metadata').$type<LinkMetadata>(),
		...timestamps,
	},
	(table) => [
		unique('page_link_unique_idx').on(table.sourceId, table.targetId),
		index('page_links_source_idx').on(table.sourceId),
		index('page_links_target_idx').on(table.targetId),
	]
);

export const MediaFormat = z.enum([
	'image', // images (jpg, png, etc)
	'video', // video files
	'audio', // audio files
	'text', // plain text, markdown
	'application', // binary data, PDFs, etc
	'unknown', // unknown format
]);
export type MediaFormat = z.infer<typeof MediaFormat>;
export const mediaFormatEnum = pgEnum('media_format', MediaFormat.options);

// Helper function for determining format from mime type
export const getMediaFormat = (contentTypeOrExtension: string): MediaFormat => {
	const fullMimeType = mime.lookup(contentTypeOrExtension);
	if (!fullMimeType) {
		return MediaFormat.enum.unknown;
	}
	const type = fullMimeType.split('/')[0];
	switch (type) {
		case 'image':
			return MediaFormat.enum.image;
		case 'video':
			return MediaFormat.enum.video;
		case 'audio':
			return MediaFormat.enum.audio;
		case 'text':
			return MediaFormat.enum.text;
		case 'application':
			return MediaFormat.enum.application;
		default:
			return MediaFormat.enum.unknown;
	}
};

export const media = pgTable(
	'media',
	{
		id: serial('id').primaryKey(),
		url: text('url').notNull(),
		format: mediaFormatEnum('format').notNull(),
		mimeType: text('mime_type').notNull(),
		title: text('title'),
		altText: text('alt_text'),
		caption: text('caption'),
		fileSize: integer('file_size'),
		sourcePageId: integer('source_page_id').references(() => pages.id),
		metadata: json('metadata'),
		...timestamps,
	},
	(table) => [
		unique('media_url_idx').on(table.url),
		index('media_format_idx').on(table.format),
		index('media_mime_type_idx').on(table.mimeType),
		index('media_source_idx').on(table.sourcePageId),
	]
);

// Relations
export const pageRelations = relations(pages, ({ many }) => ({
	contents: many(pageContents),
	outgoingLinks: many(pageLinks, { relationName: 'source' }),
	incomingLinks: many(pageLinks, { relationName: 'target' }),
	media: many(media, { relationName: 'sourcePage' }),
}));

export const pageContentsRelations = relations(pageContents, ({ one }) => ({
	page: one(pages, {
		fields: [pageContents.pageId],
		references: [pages.id],
	}),
}));

export const pageLinksRelations = relations(pageLinks, ({ one }) => ({
	source: one(pages, {
		fields: [pageLinks.sourceId],
		references: [pages.id],
		relationName: 'source',
	}),
	target: one(pages, {
		fields: [pageLinks.targetId],
		references: [pages.id],
		relationName: 'target',
	}),
}));

export const mediaRelations = relations(media, ({ one }) => ({
	sourcePage: one(pages, {
		fields: [media.sourcePageId],
		references: [pages.id],
		relationName: 'sourcePage',
	}),
}));

// Type exports
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageContent = typeof pageContents.$inferSelect;
export type NewPageContent = typeof pageContents.$inferInsert;
export type PageLink = typeof pageLinks.$inferSelect;
export type NewPageLink = typeof pageLinks.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;

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
		canonicalPageId: integer('canonical_page_id').references(() => pages.id),
		canonicalMediaId: integer('canonical_media_id').references(() => media.id),
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
		index('canonical_page_idx').on(table.canonicalPageId),
		index('canonical_media_idx').on(table.canonicalMediaId),
	]
);

// See-also relationships
export const indexRelations = pgTable(
	'index_relations',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => indexEntries.id)
			.notNull(),
		targetId: integer('target_id')
			.references(() => indexEntries.id)
			.notNull(),
		type: indexRelationTypeEnum('type').notNull().default('related_to'),
		...timestamps,
	},
	(table) => [unique('index_relation_unique_idx').on(table.sourceId, table.targetId, table.type)]
);

// Relations
export const indexEntriesRelations = relations(indexEntries, ({ one, many }) => ({
	canonicalPage: one(pages, {
		fields: [indexEntries.canonicalPageId],
		references: [pages.id],
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

// Type exports
export type IndexEntry = typeof indexEntries.$inferSelect;
export type NewIndexEntry = typeof indexEntries.$inferInsert;
export type IndexRelation = typeof indexRelations.$inferSelect;
export type NewIndexRelation = typeof indexRelations.$inferInsert;

/* ==============================
   FLAGS
   ============================== */

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

// Generate Zod enum from FLAGS keys
export const Flag = z.enum(
	Object.keys(FLAGS) as [keyof typeof FLAGS, ...Array<keyof typeof FLAGS>]
);
export type Flag = z.infer<typeof Flag>;
export const flagEnum = pgEnum('flag', Flag.options);

// Type safety
export type FlagData = typeof FLAGS;
export type FlagKey = keyof FlagData;

// Helper functions
export const getFlagName = (flag: Flag): string => FLAGS[flag].name;
export const getFlagEmoji = (flag: Flag): string => FLAGS[flag].emoji;
export const getFlagDescription = (flag: Flag): string => FLAGS[flag].description;

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
		sourcePlatform: text('source_platform'),
		sourceData: json('source_data'),
		mapPageId: integer('map_page_id').references(() => pages.id),
		mapImageId: integer('map_image_id').references(() => media.id),
		address: text('address'),
		timezone: text('timezone'),
		population: integer('population'),
		elevation: integer('elevation'),
		parentLocationId: integer('parent_location_id'),
		...timestamps,
	},
	(table) => [
		index('location_map_page_idx').on(table.mapPageId),
		index('location_map_image_idx').on(table.mapImageId),
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
	mapPage: one(pages, {
		fields: [locations.mapPageId],
		references: [pages.id],
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

// Type exports
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
