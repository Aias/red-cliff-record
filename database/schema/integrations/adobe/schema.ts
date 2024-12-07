import { contentTimestamps, databaseTimestamps } from '../../operations/common';
import { relations } from 'drizzle-orm';
import { text, timestamp, integer, json, index } from 'drizzle-orm/pg-core';
import { integrationRuns } from '../../operations';
import { integrationSchema } from '..';

export const adobeLightroomImages = integrationSchema.table(
	'adobe_lightroom_images',
	{
		id: text('id').primaryKey(),
		url2048: text('url_2048').notNull(),
		links: json('links').notNull(),
		fileName: text('file_name').notNull(),
		contentType: text('content_type').notNull(),
		sourceDevice: text('source_device'),
		cameraMake: text('camera_make'),
		cameraModel: text('camera_model'),
		cameraLens: text('camera_lens'),
		captureDate: timestamp('capture_date', { withTimezone: true }).notNull(),
		userUpdatedDate: timestamp('user_updated_date', { withTimezone: true }).notNull(),
		fileSize: integer('file_size').notNull(),
		croppedWidth: integer('cropped_width').notNull(),
		croppedHeight: integer('cropped_height').notNull(),
		aesthetics: json('aesthetics'),
		exif: json('exif'),
		location: json('location'),
		rating: integer('rating'),
		autoTags: text('auto_tags').array(),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.integrationRunId), index().on(table.captureDate)]
);

export const adobeLightroomImagesRelations = relations(adobeLightroomImages, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [adobeLightroomImages.integrationRunId],
		references: [integrationRuns.id],
	}),
}));

export type AdobeLightroomImage = typeof adobeLightroomImages.$inferSelect;
export type NewAdobeLightroomImage = typeof adobeLightroomImages.$inferInsert;
