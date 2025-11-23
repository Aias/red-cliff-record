import { z } from 'zod';
import { emptyStringToNull } from '@/shared/lib/formatting';

const RaindropRefSchema = z.object({
	$ref: z.string(),
	$id: z.number().int(),
});

const RaindropMediaSchema = z.object({
	link: z.url(),
	type: z.string(),
});

const RaindropCollectionRefSchema = z.object({
	$ref: z.string(),
	$id: z.number().int(),
	oid: z.number().int(),
});

const RaindropFileSchema = z.object({
	name: z.string(),
	size: z.number(),
	type: z.string(),
});

const RaindropHighlightSchema = z.object({
	_id: z.string(),
	text: z.string(),
	// color: z.enum([ // Specified in documentation, but not returned in API responses
	// 	'blue',
	// 	'brown',
	// 	'cyan',
	// 	'gray',
	// 	'green',
	// 	'indigo',
	// 	'orange',
	// 	'pink',
	// 	'purple',
	// 	'red',
	// 	'teal',
	// 	'yellow',
	// ]),
	note: emptyStringToNull(z.string()),
	created: z.coerce.date(),
	lastUpdate: z.coerce.date().optional(),
	creatorRef: z.number().int().positive().optional(),
});

const RaindropCreatorSchema = z.object({
	_id: z.number().int().positive(),
	avatar: z.url().optional(),
	name: z.string(),
	email: emptyStringToNull(z.email()),
});

const RaindropCacheSchema = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('ready'),
		size: z.number().int().positive(),
		created: z.coerce.date(),
	}),
	z.object({
		status: z.enum(['failed', 'invalid-origin', 'invalid-timeout', 'invalid-size']),
	}),
	z.object({
		status: z.literal('retry'),
		retries: z.number().int().positive(),
		retryAfter: z.coerce.date(),
	}),
]);

export const RaindropSchema = z.object({
	_id: z.number().int().positive(),
	link: z.url(),
	title: z.string(),
	excerpt: emptyStringToNull(z.string()),
	note: emptyStringToNull(z.string()),
	type: z.enum(['link', 'article', 'image', 'video', 'document', 'audio']),
	user: RaindropRefSchema,
	cover: emptyStringToNull(z.url()),
	media: z.array(RaindropMediaSchema),
	tags: z.array(z.string()),
	important: z.coerce.boolean(),
	reminder: z.object({ date: z.coerce.date().nullable() }).optional(),
	removed: z.boolean(),
	created: z.coerce.date(),
	collection: RaindropCollectionRefSchema,
	highlights: z.array(RaindropHighlightSchema),
	lastUpdate: z.coerce.date(),
	domain: z.string(),
	file: RaindropFileSchema.optional(),
	creatorRef: z.union([RaindropCreatorSchema, z.number().int().positive()]), // API started returning creatorRef as an integer ID on 2025-02-25
	sort: z.number().int().positive().nullable(),
	broken: z.coerce.boolean(),
	cache: RaindropCacheSchema.optional(),
	collectionId: z.number().int(),
});

export const RaindropResponseSchema = z.object({
	items: z.array(RaindropSchema),
	count: z.number().int().positive(),
	result: z.boolean(),
});

const RaindropCollectionAccessSchema = z.object({
	for: z.number().int(),
	level: z.number().int(),
	root: z.boolean(),
	draggable: z.boolean(),
});

export const RaindropCollectionSchema = z.object({
	_id: z.number().int(),
	access: RaindropCollectionAccessSchema,
	color: z.string().optional(),
	count: z.number().int(),
	cover: z.array(z.string()),
	created: z.coerce.date(),
	creatorRef: RaindropCreatorSchema,
	description: emptyStringToNull(z.string()),
	expanded: z.boolean(),
	lastAction: z.coerce.date(),
	lastUpdate: z.coerce.date(),
	parent: RaindropRefSchema.optional().nullable(),
	public: z.boolean(),
	sort: z.number().int().nullable(),
	title: z.string(),
	user: RaindropRefSchema,
	view: z.string(),
});

export const CollectionsResponseSchema = z.object({
	items: z.array(RaindropCollectionSchema),
	result: z.boolean(),
});

export type Raindrop = z.infer<typeof RaindropSchema>;
export type RaindropResponse = z.infer<typeof RaindropResponseSchema>;
export type RaindropCollection = z.infer<typeof RaindropCollectionSchema>;
export type CollectionsResponse = z.infer<typeof CollectionsResponseSchema>;
