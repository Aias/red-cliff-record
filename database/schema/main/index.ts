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
} from 'drizzle-orm/pg-core';
import { relations, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import mime from 'mime-types';
import { timestamps } from '../common';

/* ==============================
   TIMEPOINTS AND EVENTS
   ============================== */

// Zod enums
export const TimepointType = z.enum([
	'instant',
	'minute',
	'hour',
	'day',
	'week',
	'month',
	'quarter',
	'year',
	'decade',
	'century',
]);
export type TimepointType = z.infer<typeof TimepointType>;

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
		...timestamps,
	},
	(table) => [
		index('timepoint_start_date_idx').on(table.startDate),
		index('timepoint_start_instant_idx').on(table.startInstant),
		index('timepoint_start_granularity_idx').on(table.startGranularity),
		index('timepoint_end_date_idx').on(table.endDate),
		index('timepoint_end_instant_idx').on(table.endInstant),
		index('timepoint_end_granularity_idx').on(table.endGranularity),
	]
);

// New junction table for record-timepoint relationships
export const recordTimepoints = pgTable(
	'record_timepoints',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id)
			.notNull(),
		timepointId: integer('timepoint_id')
			.references(() => timepoints.id)
			.notNull(),
		label: text('label'),
		order: text('order').notNull().default('a0'),
		...timestamps,
	},
	(table) => [
		index('record_timepoint_record_idx').on(table.recordId),
		index('record_timepoint_timepoint_idx').on(table.timepointId),
	]
);

// Relations
export const timepointsRelations = relations(timepoints, ({ many }) => ({
	timepoints: many(recordTimepoints),
}));

// Type exports
export type Timepoint = typeof timepoints.$inferSelect;
export type NewTimepoint = typeof timepoints.$inferInsert;
export type RecordTimepoint = typeof recordTimepoints.$inferSelect;
export type NewRecordTimepoint = typeof recordTimepoints.$inferInsert;

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
		fileSize: integer('file_size'),
		width: integer('width'),
		height: integer('height'),
		versionOfMediaId: integer('version_of_media_id'),
		sourcePageId: integer('source_page_id').references(() => pages.id),
		metadata: json('metadata'),
		...timestamps,
	},
	(table) => [
		foreignKey({
			columns: [table.versionOfMediaId],
			foreignColumns: [table.id],
		}),
		unique('media_url_idx').on(table.url),
		index('media_format_idx').on(table.format),
		index('media_mime_type_idx').on(table.mimeType),
		index('media_source_idx').on(table.sourcePageId),
		index('media_version_idx').on(table.versionOfMediaId),
	]
);

// Relations
export const pageRelations = relations(pages, ({ many }) => ({
	contents: many(pageContents),
	outgoingLinks: many(pageLinks, { relationName: 'source' }),
	incomingLinks: many(pageLinks, { relationName: 'target' }),
	media: many(media, { relationName: 'pageMedia' }),
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

export const mediaRelations = relations(media, ({ one, many }) => ({
	page: one(pages, {
		fields: [media.sourcePageId],
		references: [pages.id],
		relationName: 'pageMedia',
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
	'category ', // what something is about
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

/* ==============================
   RECORDS
   ============================== */

// Enums
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
export const recordTypeEnum = pgEnum('record_type', RecordType.options);

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
export const creatorRoleTypeEnum = pgEnum('creator_role_type', CreatorRoleType.options);

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
export const recordRelationTypeEnum = pgEnum('record_relation_type', RecordRelationType.options);

export const CategorizationType = z.enum([
	'about', // meta-level subject matter
	'file_under', // organizational category
]);
export type CategorizationType = z.infer<typeof CategorizationType>;
export const categorizationTypeEnum = pgEnum('categorization_type', CategorizationType.options);

// Main records table
export const records = pgTable(
	'records',
	{
		id: serial('id').primaryKey(),
		title: text('title'),
		content: text('content'),
		type: recordTypeEnum('type').notNull(),
		formatId: integer('format_id').references(() => indexEntries.id),
		private: boolean('private').notNull().default(false),
		flags: flagEnum('flags').array(),
		locationId: integer('location_id').references(() => locations.id),
		...timestamps,
	},
	(table) => [
		index('record_type_idx').on(table.type),
		index('record_format_idx').on(table.formatId),
		index('record_location_idx').on(table.locationId),
	]
);

// Combined hierarchy/relations table
export const recordRelations = pgTable(
	'record_relations',
	{
		id: serial('id').primaryKey(),
		sourceId: integer('source_id')
			.references(() => records.id)
			.notNull(),
		targetId: integer('target_id')
			.references(() => records.id)
			.notNull(),
		type: recordRelationTypeEnum('type').notNull(),
		order: text('order').notNull().default('a0'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		index('record_relation_source_idx').on(table.sourceId),
		index('record_relation_target_idx').on(table.targetId),
		unique('record_relation_unique_idx').on(table.sourceId, table.targetId, table.type),
	]
);

// Creator relationships
export const recordCreators = pgTable(
	'record_creators',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id)
			.notNull(),
		entityId: integer('entity_id')
			.references(() => indexEntries.id)
			.notNull(),
		role: creatorRoleTypeEnum('role').notNull(),
		order: text('order').notNull().default('a0'),
		notes: text('notes'),
		...timestamps,
	},
	(table) => [
		index('record_creator_record_idx').on(table.recordId),
		index('record_creator_entity_idx').on(table.entityId),
		unique('record_creator_unique_idx').on(table.recordId, table.entityId, table.role),
	]
);

// Categorization
export const recordCategories = pgTable(
	'record_categories',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id)
			.notNull(),
		categoryId: integer('category_id')
			.references(() => indexEntries.id)
			.notNull(),
		type: categorizationTypeEnum('type').notNull(),
		primary: boolean('primary').notNull().default(false),
		...timestamps,
	},
	(table) => [
		index('record_category_record_idx').on(table.recordId),
		index('record_category_category_idx').on(table.categoryId),
		unique('record_category_unique_idx').on(table.recordId, table.categoryId, table.type),
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
			.references(() => records.id)
			.notNull(),
		mediaId: integer('media_id')
			.references(() => media.id)
			.notNull(),
		caption: text('caption'),
		order: text('order').notNull().default('a0'),
		...timestamps,
	},
	(table) => [
		index('record_media_record_idx').on(table.recordId),
		index('record_media_media_idx').on(table.mediaId),
		unique('record_media_unique_idx').on(table.recordId, table.mediaId),
	]
);

// Page links
export const recordPages = pgTable(
	'record_pages',
	{
		id: serial('id').primaryKey(),
		recordId: integer('record_id')
			.references(() => records.id)
			.notNull(),
		pageId: integer('page_id')
			.references(() => pages.id)
			.notNull(),
		order: text('order').notNull().default('a0'),
		...timestamps,
	},
	(table) => [
		index('record_page_record_idx').on(table.recordId),
		index('record_page_page_idx').on(table.pageId),
		unique('record_page_unique_idx').on(table.recordId, table.pageId),
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
	pages: many(recordPages),
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

// Type exports
export type Record = typeof records.$inferSelect;
export type NewRecord = typeof records.$inferInsert;
export type RecordRelation = typeof recordRelations.$inferSelect;
export type NewRecordRelation = typeof recordRelations.$inferInsert;
export type RecordCreator = typeof recordCreators.$inferSelect;
export type NewRecordCreator = typeof recordCreators.$inferInsert;
export type RecordCategory = typeof recordCategories.$inferSelect;
export type NewRecordCategory = typeof recordCategories.$inferInsert;
export type RecordMedia = typeof recordMedia.$inferSelect;
export type NewRecordMedia = typeof recordMedia.$inferInsert;
export type RecordPage = typeof recordPages.$inferSelect;
export type NewRecordPage = typeof recordPages.$inferInsert;

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

export const recordPagesRelations = relations(recordPages, ({ one }) => ({
	record: one(records, {
		fields: [recordPages.recordId],
		references: [records.id],
	}),
	page: one(pages, {
		fields: [recordPages.pageId],
		references: [pages.id],
	}),
}));
