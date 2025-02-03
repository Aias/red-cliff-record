import { z } from 'zod';

export const LightroomAssetLinksSchema = z.object({
	self: z.object({ href: z.string() }),
	'/rels/comments': z.object({ href: z.string(), count: z.number() }),
	'/rels/favorites': z.object({ href: z.string(), count: z.number() }),
	'/rels/rendition_type/2048': z.object({ href: z.string() }),
	'/rels/rendition_type/1280': z.object({ href: z.string() }),
	'/rels/rendition_type/640': z.object({ href: z.string() }),
	'/rels/rendition_type/thumbnail2x': z.object({ href: z.string() }),
	'/rels/rendition_generate/fullsize': z.object({ href: z.string(), templated: z.boolean() }),
	'/rels/profiles/camera': z.object({ filename: z.string(), href: z.string() }).optional(),
});
export type LightroomAssetLinks = z.infer<typeof LightroomAssetLinksSchema>;

const LightroomAssetDevelopSchema = z.object({
	croppedWidth: z.number(),
	croppedHeight: z.number(),
	fromDefaults: z.boolean().optional(),
	userOrientation: z.number().optional(),
	profiles: z
		.object({
			camera: z.object({ filename: z.string(), href: z.string() }),
		})
		.optional(),
	crsHDREditMode: z.boolean().optional(),
	device: z.string().optional(),
	processingModel: z.string().optional(),
	crsVersion: z.string().optional(),
	xmpCameraRaw: z.union([z.object({ sha256: z.string() }), z.string()]).optional(),
	userUpdated: z.string().optional(),
});

export const LightroomAssetExifSchema = z.object({
	ApertureValue: z.tuple([z.number(), z.number()]),
	FNumber: z.tuple([z.number(), z.number()]),
	MaxApertureValue: z.tuple([z.number(), z.number()]).optional(),
	FocalLength: z.tuple([z.number(), z.number()]),
	LightSource: z.string().optional(),
	DateTimeOriginal: z.string(),
	ExposureBiasValue: z.tuple([z.number(), z.number()]),
	ExposureTime: z.tuple([z.number(), z.number()]),
	MeteringMode: z.string(),
	FocalLengthIn35mmFilm: z.number().optional(),
	ISOSpeedRatings: z.number(),
	ShutterSpeedValue: z.tuple([z.number(), z.number()]),
	ExposureProgram: z.string(),
	FlashFired: z.boolean(),
	FlashFunction: z.boolean().optional(),
	FlashRedEyeMode: z.boolean().optional(),
	FlashReturn: z.string().optional(),
	FlashMode: z.string().optional(),
});
export type LightroomAssetExif = z.infer<typeof LightroomAssetExifSchema>;

const LightroomAssetXmpSchema = z.object({
	dng: z.object({ IsAppleProRAW: z.boolean() }).optional(),
	tiff: z.object({
		Orientation: z.string(),
		Make: z.string(),
		Model: z.string(),
	}),
	exif: LightroomAssetExifSchema,
	aux: z.object({
		SerialNumber: z.string().optional(),
		Lens: z.string().optional(),
		EnhanceDetailsVersion: z.string().optional(),
		EnhanceDetailsAlreadyApplied: z.boolean().optional(),
	}),
	xmp: z.object({
		CreatorTool: z.string().optional(),
		CreateDate: z.string(),
		ModifyDate: z.string(),
	}),
	photoshop: z.object({ DateCreated: z.string() }),
});

export const LightroomAestheticsSchema = z.object({
	application: z.string(),
	balancing: z.number(),
	content: z.number(),
	created: z.string(),
	dof: z.number(),
	emphasis: z.number(),
	harmony: z.number(),
	lighting: z.number(),
	repetition: z.number(),
	rot: z.number(),
	score: z.number(),
	symmetry: z.number(),
	version: z.number(),
	vivid: z.number(),
});
export type LightroomAesthetics = z.infer<typeof LightroomAestheticsSchema>;
export const LightroomAutoTagsSchema = z.object({
	tags: z.record(z.number().min(0).max(100)),
	application: z.string(),
	version: z.number(),
	created: z.coerce.date(),
});

const LightroomAssetPayloadImportSourceSchema = z.object({
	importedOnDevice: z.string(),
	importTimestamp: z.coerce.date(),
	contentType: z.string(),
	fileName: z.string(),
	fileSize: z.number().int().positive(),
	originalHeight: z.number().int().positive(),
	originalWidth: z.number().int().positive(),
	sha256: z.string(),
	originalDigest: z.string().optional(),
	importedBy: z.string(),
	localAssetId: z.string().optional(),
	uniqueDeviceId: z.string().optional(),
});

export const LightroomLocationSchema = z.object({
	latitude: z.number(),
	longitude: z.number(),
	altitude: z.number(),
	country: z.string(),
	isoCountryCode: z.string(),
	state: z.string(),
	city: z.string().optional(),
	sublocation: z.array(z.string()).optional(),
});
export type LightroomLocation = z.infer<typeof LightroomLocationSchema>;

const LightroomAssetPayloadSchema = z.object({
	develop: LightroomAssetDevelopSchema,
	userUpdated: z.coerce.date(),
	captureDate: z.coerce.date(),
	userCreated: z.coerce.date(),
	changedAtTime: z.coerce.date().optional(),
	xmp: LightroomAssetXmpSchema,
	ratings: z
		.record(
			z.object({
				rating: z.number(),
				date: z.string().optional(),
			})
		)
		.optional(),
	aesthetics: LightroomAestheticsSchema,
	autoTags: LightroomAutoTagsSchema,
	location: LightroomLocationSchema.optional(),
	importSource: LightroomAssetPayloadImportSourceSchema,
	changedOnDevice: z.string().optional(),
	order: z.string().optional(),
	aux: z
		.record(
			z.object({
				digest: z.string(),
				fileSize: z.number(),
				sha256: z.string(),
				type: z.string(),
			})
		)
		.optional(),
});

const LightroomAssetSchema = z.object({
	id: z.string(),
	type: z.string(),
	subtype: z.string(),
	created: z.coerce.date(),
	updated: z.coerce.date(),
	revision_ids: z.array(z.string()).optional(),
	links: LightroomAssetLinksSchema,
	payload: LightroomAssetPayloadSchema,
});

const LightroomResourceSchema = z.object({
	id: z.string(),
	type: z.string(),
	created: z.string(),
	updated: z.string(),
	revision_ids: z.array(z.string()),
	links: z.object({
		self: z.object({ href: z.string() }),
	}),
	asset: LightroomAssetSchema,
	payload: z.object({
		order: z.string().optional(),
		userCreated: z.coerce.date(),
		userUpdated: z.coerce.date(),
	}),
});

export const LightroomJsonResponseSchema = z.object({
	base: z.string(),
	album: z.object({
		id: z.string(),
		links: z.object({
			self: z.object({ href: z.string() }),
		}),
	}),
	resources: z.array(LightroomResourceSchema),
});

export type LightroomJsonResponse = z.infer<typeof LightroomJsonResponseSchema>;
