import { relations } from 'drizzle-orm';
import {
	index,
	integer,
	json,
	pgTable,
	serial,
	text,
	unique,
	type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { databaseTimestamps } from '../common';
import { media } from './media';
import { sources } from './sources';

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
		parentLocationId: integer('parent_location_id').references((): AnyPgColumn => locations.id, {
			onDelete: 'cascade',
			onUpdate: 'cascade',
		}),
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.mapPageId),
		index().on(table.mapImageId),
		index().on(table.locationType),
		index().on(table.parentLocationId),
		unique().on(table.name, table.locationType, table.parentLocationId),
	]
);

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
