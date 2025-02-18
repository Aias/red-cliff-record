import { relations } from 'drizzle-orm';
import { index, integer, json, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type {
	LightroomAesthetics,
	LightroomAssetExif,
	LightroomAssetLinks,
	LightroomLocation,
} from '@/server/integrations/adobe/types';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const lightroomImages = pgTable(
	'lightroom_images',
	{
		id: text('id').primaryKey(),
		url2048: text('url_2048').notNull(),
		links: json('links').$type<LightroomAssetLinks>().notNull(),
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
		aesthetics: json('aesthetics').$type<LightroomAesthetics>(),
		exif: json('exif').$type<LightroomAssetExif>(),
		location: json('location').$type<LightroomLocation>(),
		rating: integer('rating'),
		autoTags: text('auto_tags').array(),
		integrationRunId: integer('integration_run_id')
			.references(() => integrationRuns.id)
			.notNull(),
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
		index().on(table.recordId),
		index().on(table.mediaId),
	]
);

export const LightroomImageSelectSchema = createSelectSchema(lightroomImages);
export type LightroomImageSelect = typeof lightroomImages.$inferSelect;
export const LightroomImageInsertSchema = createInsertSchema(lightroomImages);
export type LightroomImageInsert = typeof lightroomImages.$inferInsert;

export const lightroomImagesRelations = relations(lightroomImages, ({ one }) => ({
	integrationRun: one(integrationRuns, {
		fields: [lightroomImages.integrationRunId],
		references: [integrationRuns.id],
	}),
	record: one(records, {
		fields: [lightroomImages.recordId],
		references: [records.id],
	}),
	media: one(media, {
		fields: [lightroomImages.mediaId],
		references: [media.id],
	}),
}));

export const lightroomIntegrationRelations = relations(integrationRuns, ({ many }) => ({
	lightroomImages: many(lightroomImages),
}));
