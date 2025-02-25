import { z } from 'zod';
import { emptyStringToNull } from '@/app/lib/formatting';

const RaindropRefSchema = z.object({
	$ref: z.string(),
	$id: z.number().int(),
});

const RaindropMediaSchema = z.object({
	link: z.string().url(),
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
	note: emptyStringToNull(z.string()),
	created: z.coerce.date(),
	lastUpdate: z.coerce.date(),
	creatorRef: z.number().int().positive(),
});

const RaindropCreatorSchema = z.object({
	_id: z.number().int().positive(),
	avatar: z.string().url(),
	name: z.string(),
	email: emptyStringToNull(z.string().email()),
});

const RaindropCacheSchema = z.discriminatedUnion('status', [
	z.object({
		status: z.literal('ready'),
		size: z.number().int().positive(),
		created: z.coerce.date(),
	}),
	z.object({
		status: z.enum(['failed', 'invalid-origin', 'invalid-timeout']),
	}),
	z.object({
		status: z.literal('retry'),
		retries: z.number().int().positive(),
		retryAfter: z.coerce.date(),
	}),
]);

export const RaindropSchema = z.object({
	_id: z.number().int().positive(),
	title: z.string(),
	excerpt: emptyStringToNull(z.string()),
	note: emptyStringToNull(z.string()),
	link: z.string().url(),
	created: z.coerce.date(),
	lastUpdate: z.coerce.date(),
	reminder: z.object({ date: z.coerce.date().nullable() }).optional(),
	tags: z.array(z.string()),
	type: z.string(),
	cover: emptyStringToNull(z.string().url()),
	domain: z.string(),
	user: RaindropRefSchema,
	media: z.array(RaindropMediaSchema),
	collection: RaindropCollectionRefSchema,
	file: RaindropFileSchema.optional(),
	highlights: z.array(RaindropHighlightSchema),
	important: z.coerce.boolean(),
	removed: z.boolean(),
	creatorRef: RaindropCreatorSchema,
	sort: z.number().int().positive(),
	broken: z.boolean().optional(),
	cache: RaindropCacheSchema.optional(),
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
	count: z.number(),
	cover: z.array(z.string()),
	created: z.coerce.date(),
	description: emptyStringToNull(z.string()),
	expanded: z.boolean(),
	lastAction: z.coerce.date(),
	lastUpdate: z.coerce.date(),
	parent: RaindropRefSchema.optional().nullable(),
	public: z.boolean(),
	sort: z.number().int(),
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
