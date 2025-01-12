import { relations } from 'drizzle-orm';
import {
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	time,
	timestamp,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { databaseTimestamps } from '../common';
import { records } from '.';

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

export const timepointTypeEnum = pgEnum('timepoint_type', TimepointType.options);

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
