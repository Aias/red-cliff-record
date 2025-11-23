import { z } from 'zod';

// Convert Airtable Attachment type to Zod schema
export const AirtableAttachmentSchema = z.object({
	id: z.string(),
	url: z.url(),
	filename: z.string(),
	size: z.number().int().min(0).optional(),
	type: z.string(),
	width: z.number().int().min(0).optional(),
	height: z.number().int().min(0).optional(),
});

export const ExtractFieldSetSchema = z.object({
	id: z.string(),
	title: z.string(),
	format: z.string(),
	michelinStars: z.number().int().min(0).max(3).default(0),
	source: z.url().optional(),
	creators: z.array(z.string()).optional(),
	extract: z.string().optional(),
	parent: z.array(z.string()).optional(),
	children: z.array(z.string()).optional(),
	spaces: z.array(z.string()).optional(),
	connections: z.array(z.string()).optional(),
	images: z.array(AirtableAttachmentSchema).optional(),
	imageCaption: z.string().optional(),
	notes: z.string().optional(),
	extractedOn: z.coerce.date(),
	lastUpdated: z.coerce.date(),
	published: z.coerce.boolean(),
	publishedOn: z.coerce.date().optional(),
	numChildren: z.number().int().min(0),
	numFragments: z.number().int().min(0),
	spaceTopics: z.array(z.string()).optional(),
	connectionTitles: z.array(z.string()).optional(),
	childTitles: z.array(z.string()).optional(),
	creatorNames: z.array(z.string()).optional(),
	parentTitle: z.array(z.string()).optional(),
	parentCreatorNames: z.array(z.string()).optional(),
	parentCreatorIds: z.array(z.string()).optional(),
	parentId: z.array(z.string()).optional(),
	creatorIds: z.array(z.string()).optional(),
	spaceIds: z.array(z.string()).optional(),
	connectionIds: z.array(z.string()).optional(),
	childIds: z.array(z.string()).optional(),
	creatorsLookup: z.string().optional(),
	spacesLookup: z.string().optional(),
	search: z.string(),
	extractsLookup: z.string(),
	slug: z.string(),
	score: z.number().min(0),
	hasImages: z.coerce.boolean(),
});

const relevanceCalculation = z
	.union([z.number(), z.object({ specialValue: z.string() })])
	.transform((val) => {
		if (typeof val === 'number') return val;
		return 0;
	})
	.default(0);

export const CreatorFieldSetSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string().optional(),
	primaryProject: z.string().optional(),
	site: z.url().optional(),
	professions: z.array(z.string()).optional(),
	organizations: z.array(z.string()).optional(),
	nationality: z.array(z.string()).optional(),
	extracts: z.array(z.string()).optional(),
	numExtracts: z.number().int().min(0),
	numWorks: z.number().int().min(0),
	extractTitles: z.array(z.string()).optional(),
	numFragments: z.number().int().min(0),
	extractIds: z.array(z.string()).optional(),
	totalStars: z.number().int().min(0),
	slug: z.string(),
	relevance: relevanceCalculation,
	starred: z.coerce.boolean(),
	extractScore: z.number().min(0),
	createdTime: z.coerce.date(),
	lastUpdated: z.coerce.date(),
});

export const SpaceFieldSetSchema = z.object({
	id: z.string(),
	topic: z.string(),
	icon: z.string().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	extracts: z.array(z.string()).optional(),
	numExtracts: z.number().int().min(0),
	extractIds: z.array(z.string()).optional(),
	extractTitles: z.array(z.string()).optional(),
	totalStars: z.number().int().min(0).default(0),
	slug: z.string(),
	extractScore: z.number().min(0),
	relevance: relevanceCalculation,
	createdTime: z.coerce.date(),
	lastUpdated: z.coerce.date(),
});

export type ExtractFieldSet = z.infer<typeof ExtractFieldSetSchema>;
export type CreatorFieldSet = z.infer<typeof CreatorFieldSetSchema>;
export type SpaceFieldSet = z.infer<typeof SpaceFieldSetSchema>;
