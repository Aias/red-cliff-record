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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { timestamps } from './common';

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

/*
URLS
*/

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
	(table) => [unique('url_idx').on(table.url)]
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
