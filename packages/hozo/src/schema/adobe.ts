import { index, integer, json, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { media } from './media';
import { contentTimestamps, databaseTimestamps } from './operations';
import { integrationRuns } from './operations';
import { records } from './records';

export const lightroomImages = pgTable(
	'lightroom_images',
	{
		id: text('id').primaryKey(),
		url2048: text('url_2048').notNull(),
		baseUrl: text('base_url').notNull(),
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
		deletedAt: timestamp('deleted_at', {
			withTimezone: true,
		}),
		...contentTimestamps,
		...databaseTimestamps,
	},
	(table) => [index().on(table.recordId), index().on(table.mediaId), index().on(table.deletedAt)]
);

export const LightroomImageSelectSchema = createSelectSchema(lightroomImages);
export type LightroomImageSelect = typeof lightroomImages.$inferSelect;
export const LightroomImageInsertSchema = createInsertSchema(lightroomImages);
export type LightroomImageInsert = typeof lightroomImages.$inferInsert;

export type LightroomAssetLinks = {
	self: { href: string };
	'/rels/comments': { href: string; count: number };
	'/rels/favorites': { href: string; count: number };
	'/rels/rendition_type/2048': { href: string };
	'/rels/rendition_type/1280': { href: string };
	'/rels/rendition_type/640': { href: string };
	'/rels/rendition_type/thumbnail2x': { href: string };
	'/rels/rendition_generate/fullsize': { href: string; templated: boolean };
	'/rels/profiles/camera'?: { filename: string; href: string };
};

export type LightroomAssetExif = {
	ApertureValue: [number, number];
	FNumber: [number, number];
	MaxApertureValue?: [number, number];
	FocalLength: [number, number];
	LightSource?: string;
	DateTimeOriginal: string;
	ExposureBiasValue: [number, number];
	ExposureTime: [number, number];
	MeteringMode: string;
	FocalLengthIn35mmFilm?: number;
	ISOSpeedRatings: number;
	ShutterSpeedValue: [number, number];
	ExposureProgram: string;
	FlashFired: boolean;
	FlashFunction?: boolean;
	FlashRedEyeMode?: boolean;
	FlashReturn?: string;
	FlashMode?: string;
};

export type LightroomAesthetics = {
	application: string;
	balancing: number;
	content: number;
	created: string;
	dof: number;
	emphasis: number;
	harmony: number;
	lighting: number;
	repetition: number;
	rot: number;
	score: number;
	symmetry: number;
	version: number;
	vivid: number;
};

export type LightroomLocation = {
	latitude: number;
	longitude: number;
	altitude: number;
	country: string;
	isoCountryCode: string;
	state: string;
	city?: string;
	sublocation?: string[];
};
