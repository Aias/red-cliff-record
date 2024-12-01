import { timestamps } from './common';
import { relations } from 'drizzle-orm';
import { pgSchema, text, timestamp, integer, json, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from './integrations';

export const adobeSchema = pgSchema('adobe');

export const photographs = adobeSchema.table(
	'photographs',
	{
		id: text('id').primaryKey(),
		url2048: text().notNull(),
		links: json().notNull(),
		fileName: text().notNull(),
		contentType: text().notNull(),
		sourceDevice: text(),
		cameraMake: text(),
		cameraModel: text(),
		cameraLens: text(),
		captureDate: timestamp({ withTimezone: true }).notNull(),
		userUpdatedDate: timestamp({ withTimezone: true }).notNull(),
		fileSize: integer().notNull(),
		croppedWidth: integer().notNull(),
		croppedHeight: integer().notNull(),
		aesthetics: json(),
		exif: json(),
		location: json(),
		rating: integer(),
		autoTags: text().array(),
		integrationRunId: integer()
			.references(() => integrationRuns.id)
			.notNull(),
		...timestamps,
	},
	(table) => [index().on(table.integrationRunId), index().on(table.captureDate)]
);

export const adobeLightroomImagesRelations = relations(photographs, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [photographs.integrationRunId],
		references: [integrationRuns.id],
	}),
}));
