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

export const CertaintyType = z.enum(['fixed', 'estimated', 'target', 'tentative', 'milestone']);

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
	}),
	secondaryTimepoint: one(timepoints, {
		fields: [events.secondaryTimepoint],
		references: [timepoints.id],
	}),
	parent: one(events, {
		fields: [events.parentEventId],
		references: [events.id],
	}),
	children: many(events),
}));

export const timepointsRelations = relations(timepoints, ({ many }) => ({
	primaryEvents: many(events, { relationName: 'primaryTimepoint' }),
	secondaryEvents: many(events, { relationName: 'secondaryTimepoint' }),
}));

// Type exports for use in application code
export type TimepointType = z.infer<typeof TimepointType>;
export type EventType = z.infer<typeof EventType>;
export type CertaintyType = z.infer<typeof CertaintyType>;

// You can also export the full table types
export type Timepoint = typeof timepoints.$inferSelect;
export type NewTimepoint = typeof timepoints.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
