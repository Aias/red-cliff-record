import { relations } from 'drizzle-orm';
import { index, integer, json, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { type z } from 'zod';
import { contentTimestamps, databaseTimestamps } from '../common';
import { media, records } from '../main';
import { integrationRuns } from '../operations';
import { integrationSchema } from './schema';

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
		archivedAt: timestamp('archived_at', {
			withTimezone: true,
		}),
		recordId: integer('record_id').references(() => records.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		mediaId: integer('media_id').references(() => media.id, {
			onDelete: 'set null',
			onUpdate: 'cascade',
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [
		index().on(table.integrationRunId),
		index().on(table.captureDate),
		index().on(table.archivedAt),
		index().on(table.recordId),
		index().on(table.mediaId),
	]
);

export const AdobeLightroomImageSelectSchema = createSelectSchema(adobeLightroomImages);
export type AdobeLightroomImageSelect = z.infer<typeof AdobeLightroomImageSelectSchema>;
export const AdobeLightroomImageInsertSchema = createInsertSchema(adobeLightroomImages);
export type AdobeLightroomImageInsert = z.infer<typeof AdobeLightroomImageInsertSchema>;
export const AdobeLightroomImageUpdateSchema = createUpdateSchema(adobeLightroomImages);
export type AdobeLightroomImageUpdate = z.infer<typeof AdobeLightroomImageUpdateSchema>;

export const adobeLightroomImagesRelations = relations(adobeLightroomImages, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [adobeLightroomImages.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [adobeLightroomImages.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [adobeLightroomImages.mediaId],
		references: [media.id],
	}),
}));

export const adobeIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	adobeLightroomImages: many(adobeLightroomImages),
}));
